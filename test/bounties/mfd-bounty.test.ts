import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {ethers} from 'hardhat';
import {advanceTimeAndBlock} from '../../scripts/utils';
import {
	BountyManager,
	ChefIncentivesController,
	LendingPool,
	EligibilityDataProvider,
	MultiFeeDistribution,
	ERC20,
	Leverager,
	WETH,
	VariableDebtToken,
	WETHGateway,
	PriceProvider,
} from '../../typechain';
import _ from 'lodash';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
import {DeployData} from '../../scripts/deploy/types';
import {loadFixture} from '@nomicfoundation/hardhat-network-helpers';
import {deposit, doBorrow, zap} from './helpers';
import {setupTest} from '../setup';

chai.use(solidity);
const {expect} = chai;

let multiFeeDistribution: MultiFeeDistribution;
let eligibilityProvider: EligibilityDataProvider;
let lendingPool: LendingPool;
let chefIncentivesController: ChefIncentivesController;
let priceProvider: PriceProvider;
let leverager: Leverager;
let weth: WETH;
let vdWETH: VariableDebtToken;
let wethGateway: WETHGateway;
let deployData: DeployData;
let user1: SignerWithAddress;
let user2: SignerWithAddress;
let hunter: SignerWithAddress;
let deployer: SignerWithAddress;
let DEFAULT_LOCK_TIME: number;
let LOCK_DURATION: number;
let SKIP_DURATION: number;
let bountyManager: BountyManager;
let lpToken: ERC20;

const relockOptions = [true, false];
const borrowOptions = [true, false];
const defaultLockTimeOptions = [0, 1, 2, 3];

const eligibleAmt = 1000000;
// no emish, elig, too much
const depositOptions = [0, eligibleAmt, 100000000];

let runs: {
	relock: boolean;
	borrow: boolean;
	depositAmt: number;
	defaultLockTime: number;
}[] = [];

for (let i = 0; i < relockOptions.length; i++) {
	for (let j = 0; j < borrowOptions.length; j++) {
		// for (let k = 0; k < defaultLockTimeOptions.length; k++) {
		for (let m = 0; m < depositOptions.length; m++) {
			const relock = relockOptions[i];
			const borrow = borrowOptions[i];
			// const defaultLockTime = defaultLockTimeOptions[k];
			const defaultLockTime = 0;
			const depositAmt = depositOptions[m];

			runs.push({relock, borrow, depositAmt, defaultLockTime});
		}
		// }
	}
}

const generatePlatformRevenue = async (duration: number = SKIP_DURATION) => {
	await deposit('rWETH', '1000', deployer, lendingPool, deployData);
	await deposit('rUSDT', '10000', deployer, lendingPool, deployData);
	await deposit('rWBTC', '20', deployer, lendingPool, deployData);
	await deposit('rUSDC', '10000', deployer, lendingPool, deployData);

	await doBorrow('rWETH', '10', deployer, lendingPool, deployData);
	await doBorrow('rUSDT', '1000', deployer, lendingPool, deployData);
	await doBorrow('rUSDC', '1000', deployer, lendingPool, deployData);
	await doBorrow('rWBTC', '1', deployer, lendingPool, deployData);

	await advanceTimeAndBlock(duration);

	await doBorrow('rWETH', '10', deployer, lendingPool, deployData);
	await doBorrow('rUSDT', '1000', deployer, lendingPool, deployData);
	await doBorrow('rUSDC', '1000', deployer, lendingPool, deployData);
	await doBorrow('rWBTC', '1', deployer, lendingPool, deployData);

	await multiFeeDistribution.connect(deployer).getAllRewards();
	await advanceTimeAndBlock(duration);
};

const zapAndDeposit = async (relock: boolean, borrow: boolean, defaultLockTime: number, depositAmt: number) => {
	await multiFeeDistribution.connect(user1).setRelock(relock);
	await multiFeeDistribution.connect(user1).setDefaultRelockTypeIndex(defaultLockTime);
	if (borrow) {
		await deposit('rUSDC', depositAmt.toString(), user1, lendingPool, deployData);
	}
	await zap(user1, deployData, borrow && depositAmt !== 0, defaultLockTime);
	if (!borrow) {
		await deposit('rUSDC', depositAmt.toString(), user1, lendingPool, deployData);
	}

	// Now Locked
	const isEligible = await eligibilityProvider.isEligibleForRewards(user1.address);
	const lockedUsd = await eligibilityProvider.lockedUsdValue(user1.address);
	const requiredUsdValue = await eligibilityProvider.requiredUsdValue(user1.address);
	return {
		isEligible,
		lockedUsd,
		requiredUsdValue,
	};
};

const loadZappedUserFixture = async (run: any) => {
	({
		multiFeeDistribution,
		eligibilityProvider,
		multiFeeDistribution,
		lendingPool,
		priceProvider,
		deployData,
		chefIncentivesController,
		leverager,
		weth,
		wethGateway,
		LOCK_DURATION,
		bountyManager,
		user1,
		user2,
		deployer,
	} = await setupTest());
	hunter = user2;
	DEFAULT_LOCK_TIME = LOCK_DURATION;
	SKIP_DURATION = DEFAULT_LOCK_TIME / 20;
	lpToken = await ethers.getContractAt('ERC20', deployData.stakingToken);
	// Deposit assets
	await deposit('rWETH', '10000', deployer, lendingPool, deployData);

	await zapAndDeposit(run.relock, run.borrow, 0, run.depositAmt);
};

const makeHunterEligible = async () => {
	await deposit('rUSDC', '1', hunter, lendingPool, deployData);
	let lockedUsdValue = await eligibilityProvider.lockedUsdValue(hunter.address);
	const requiredUsdValue = await eligibilityProvider.requiredUsdValue(hunter.address);
	const additionalUsdRequired = requiredUsdValue.gt(lockedUsdValue)
		? requiredUsdValue.sub(lockedUsdValue)
		: ethers.BigNumber.from('0');

	if (additionalUsdRequired.gt(0)) {
		const lpTokenPriceUsd = await priceProvider.getLpTokenPriceUsd();
		const minLpDeposit = additionalUsdRequired.mul(ethers.utils.parseEther('1')).div(lpTokenPriceUsd); // both prices are in 8 decimals so 18 decimals mul needed
		const minDLPBalance = await bountyManager.minDLPBalance();
		const stakeAmount = minDLPBalance.gt(minLpDeposit) ? minDLPBalance : minLpDeposit;
		await lpToken.approve(multiFeeDistribution.address, stakeAmount);
		await multiFeeDistribution.stake(stakeAmount, hunter.address, 0);
		lockedUsdValue = await eligibilityProvider.lockedUsdValue(hunter.address);
	}
};

const canBountyHunt = async (_user: string) => {
	const minDLPBalance = await bountyManager.minDLPBalance();
	const {locked} = await multiFeeDistribution.lockedBalances(_user);
	const isEmissionsEligible = await eligibilityProvider.isEligibleForRewards(_user);
	return locked >= minDLPBalance && isEmissionsEligible;
};

// DEV: limit to 1 case
// runs = [
// 	{
// 		borrow: true,
// 		depositAmt: eligibleAmt,
// 		relock: false,
// 		defaultLockTime: 0,
// 	},
// ];
runs.forEach(function (run) {
	const {relock, borrow, depositAmt, defaultLockTime} = run;

	describe(`RL: ${relock} | BOR: ${borrow} | DEP: ${depositAmt} | LockTime: ${defaultLockTime}`, async () => {
		describe('Zap', async () => {
			before(async () => {
				await loadZappedUserFixture(run);
			});

			it('earns platform revenue', async () => {
				await generatePlatformRevenue();
				const pending1 = await multiFeeDistribution.claimableRewards(user1.address);
				const pendingWeth = pending1.filter((entry) => entry.token === deployData.allTokens['rWETH'])[0].amount;
				expect(pendingWeth).gt(0);
			});
		});

		describe('MFD', async () => {
			describe('Time DQ:', async () => {
				before(async () => {
					await loadZappedUserFixture(run);
				});

				it('no bounty when locked', async () => {
					await generatePlatformRevenue();
					const {unlockable} = await multiFeeDistribution.lockedBalances(user1.address);
					let quote = await bountyManager.quote(user1.address);
					expect(unlockable).equals(quote.bounty).equals(0);
				});

				it('base bounty when unlockable', async () => {
					await generatePlatformRevenue();
					await advanceTimeAndBlock(DEFAULT_LOCK_TIME + 1);

					const quote = await bountyManager.connect(hunter).quote(user1.address);

					const baseBounty = await bountyManager.getBaseBounty();

					expect(quote.bounty).equals(baseBounty);
				});

				it('withdraws expired locks and relocks', async () => {
					await generatePlatformRevenue();
					await advanceTimeAndBlock(DEFAULT_LOCK_TIME + 1);

					let {unlockable} = await multiFeeDistribution.lockedBalances(user1.address);
					expect(unlockable).gt(0);

					await makeHunterEligible();

					const actionType = 1;
					await bountyManager.connect(hunter).claim(user1.address, actionType);
					const lpTokenBalance = await lpToken.balanceOf(user1.address);

					// await chefIncentivesController.check(user1.address);

					if (relock) {
						expect(lpTokenBalance).equals(0);
					} else {
						expect(unlockable).equals(lpTokenBalance);
					}

					// const originalUnlockable = unlockable;
					const locked = (await multiFeeDistribution.lockedBalances(user1.address)).locked;
					if (relock) {
						expect(unlockable).equals(locked); // lock relocked
					} else {
						expect(locked).equals(0); // locks withdrawn
					}
				});

				it('doesnt earn emish', async () => {
					const pendingPre = await chefIncentivesController.allPendingRewards(user1.address);
					await advanceTimeAndBlock(DEFAULT_LOCK_TIME);
					const pendingPost = await chefIncentivesController.allPendingRewards(user1.address);
					if (relock && depositAmt === eligibleAmt) {
						// keeps earning
						expect(pendingPost).gt(pendingPre);
					} else {
						// was DQd, shouldnt earn
						expect(pendingPost).equals(pendingPre);
					}
				});
			});

			describe('New Lock DQ emissions:', async () => {
				before(async () => {
					await zapAndDeposit(run.relock, run.borrow, 0, run.depositAmt);
				});

				it('doesnt earn emish', async () => {
					const pendingPre = await chefIncentivesController.allPendingRewards(user1.address);
					await advanceTimeAndBlock(DEFAULT_LOCK_TIME);
					const pendingPost = await chefIncentivesController.allPendingRewards(user1.address);
					if (relock && depositAmt === eligibleAmt) {
						// keeps earning
						expect(pendingPost).gt(pendingPre);
					} else {
						// was DQd, shouldnt earn
						expect(pendingPost).equals(pendingPre);
					}
				});
			});
		});
	});
});
