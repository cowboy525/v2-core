import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {ethers} from 'hardhat';
import {advanceTimeAndBlock} from '../../scripts/utils';
import {
	BountyManager,
	ChefIncentivesController,
	LendingPool,
	EligibilityDataProvider,
	PriceProvider,
	MultiFeeDistribution,
	RadiantOFT,
	TestnetLockZap,
	ERC20,
	Leverager,
	WETH,
	VariableDebtToken,
	WETHGateway,
} from '../../typechain';
import _ from 'lodash';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
import {DeployConfig, DeployData, LP_PROVIDER} from '../../scripts/deploy/types';
import {sellRdnt, getLatestBlockTimestamp} from '../shared/helpers';
import {loadFixture} from '@nomicfoundation/hardhat-network-helpers';
import {BigNumber} from 'ethers';
import {deposit, doBorrow, now, zap} from './helpers';
import {setupTest} from '../setup';

chai.use(solidity);
const {expect} = chai;

const toNum = (bn: BigNumber) => {
	return parseFloat(ethers.utils.formatEther(bn));
};

let multiFeeDistribution: MultiFeeDistribution;
let eligibilityProvider: EligibilityDataProvider;
let lendingPool: LendingPool;
let chefIncentivesController: ChefIncentivesController;
let priceProvider: PriceProvider;
let weth: WETH;
let rdntToken: RadiantOFT;
let lockZap: TestnetLockZap;
let leverager: Leverager;
let vdWETH: VariableDebtToken;
let wethGateway: WETHGateway;
let deployData: DeployData;
let deployConfig: DeployConfig;
let user1: SignerWithAddress;
let user2: SignerWithAddress;
let hunter: SignerWithAddress;
let dao: SignerWithAddress;
let deployer: SignerWithAddress;
let DEFAULT_LOCK_TIME: number;
let LOCK_DURATION: number;
let SKIP_DURATION: number;
let bountyManager: BountyManager;
let lpToken: ERC20;
let stakingToken: string;

const relockOptions = [true, false];
const borrowOptions = [true, false];
const defaultLockTimeOptions = [0, 1, 2, 3];

const eligibleAmt = 1000000;
// no emish, elig, too much
const depositOptions = [0, eligibleAmt, 100000000];

let runs: {
	relock: boolean;
	depositAmt: number;
}[] = [];

for (let i = 0; i < relockOptions.length; i++) {
	// for (let j = 0; j < borrowOptions.length; j++) {
	// for (let k = 0; k < defaultLockTimeOptions.length; k++) {
	for (let m = 0; m < depositOptions.length; m++) {
		const relock = relockOptions[i];
		const depositAmt = depositOptions[m];
		runs.push({relock, depositAmt});
	}
	// }
	// }
}

const generatePlatformRevenue = async () => {
	await doBorrow('rWETH', '1000', deployer, lendingPool, deployData);
	await advanceTimeAndBlock(SKIP_DURATION);
	await doBorrow('rWETH', '1000', deployer, lendingPool, deployData);
	await multiFeeDistribution.connect(deployer).getAllRewards();
	await advanceTimeAndBlock(SKIP_DURATION);
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
		leverager,
		weth,
		wethGateway,
		deployData,
		deployConfig,
		chefIncentivesController,
		rdntToken,
		LOCK_DURATION,
		bountyManager,
		dao,
		user1,
		user2,
		deployer,
	} = await setupTest());
	const {read} = deployments;

	hunter = user2;
	// Lock index 0
	DEFAULT_LOCK_TIME = (await multiFeeDistribution.getLockDurations())[0].toNumber();
	SKIP_DURATION = DEFAULT_LOCK_TIME / 20;
	lpToken = await ethers.getContractAt('ERC20', deployData.stakingToken);
	stakingToken = await read('UniswapV2Factory', 'getPair', rdntToken.address, weth.address);

	// Deposit assets
	await deposit('rWETH', '10000', deployer, lendingPool, deployData);
	lockZap = await ethers.getContractAt('TestnetLockZap', deployData.lockZap);

	await zapAndDeposit(run.relock, run.borrow, 0, run.depositAmt); // Lock index 0
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
	console.log(`locked >= minDLPBalance: ${locked >= minDLPBalance}`);
	console.log(`isEmissionsEligible: ${isEmissionsEligible}`);
	console.log(`locked: ${locked}`);
	return locked >= minDLPBalance && isEmissionsEligible;
};

// DEV: limit to 1 case
// runs = [
// 	{
// 		depositAmt: eligibleAmt,
// 		relock: true,
// 	},
// ];
runs.forEach(function (run) {
	const {relock, depositAmt} = run;

	describe(`RL: ${relock} | DEP: ${depositAmt}`, async () => {
		describe('Zap', async () => {
			before(async () => {
				run.borrow = true;
				await loadZappedUserFixture(run);
			});

			it('has eligible states', async () => {
				const isEligible = await eligibilityProvider.isEligibleForRewards(user1.address);
				const lastEligibleTime = await eligibilityProvider.lastEligibleTime(user1.address);
				const requiredUsdValue = await eligibilityProvider.requiredUsdValue(user1.address);

				const expectedEligible = depositAmt === eligibleAmt;
				expect(isEligible).equal(expectedEligible);

				let expectedLastEligible;
				if (isEligible) {
					expectedLastEligible = (await now()) + DEFAULT_LOCK_TIME;
				} else {
					expectedLastEligible = BigNumber.from(0);
				}
				expect(lastEligibleTime.toNumber()).closeTo(expectedLastEligible, 10);

				if (depositAmt > 0) {
					expect(requiredUsdValue).gt(0);
				}
			});

			it('earns emissions when applicable', async () => {
				await advanceTimeAndBlock(SKIP_DURATION);
				const pending1 = await chefIncentivesController.allPendingRewards(user1.address);
				await advanceTimeAndBlock(SKIP_DURATION);
				const pending2 = await chefIncentivesController.allPendingRewards(user1.address);

				if (depositAmt == eligibleAmt) {
					expect(pending2).gt(pending1);
				} else {
					expect(pending2).equals(0);
				}
			});

			it('earns platform revenue', async () => {
				await generatePlatformRevenue();
				const pending1 = await multiFeeDistribution.claimableRewards(user1.address);
				const pendingWeth = pending1.filter((entry) => entry.token === deployData.allTokens['rWETH'])[0].amount;
				expect(pendingWeth).gt(0);
			});
		});

		describe('CIC', async () => {
			describe('Time DQ:', async () => {
				let pendingAtEndOfEligibility: BigNumber, pendingAfterInelig: BigNumber, pending3;

				before(async () => {
					await loadZappedUserFixture(run);
					// await generatePlatformRevenue();
					const lastEligibleTime = (await eligibilityProvider.lastEligibleTime(user1.address)).toNumber();
					if (lastEligibleTime != 0) {
						await advanceTimeAndBlock(lastEligibleTime - (await now()) - 1);
					}
					pendingAtEndOfEligibility = await chefIncentivesController.allPendingRewards(user1.address);
					await advanceTimeAndBlock(DEFAULT_LOCK_TIME);
					pendingAfterInelig = await chefIncentivesController.allPendingRewards(user1.address);
					const minDLPBalance = await bountyManager.minDLPBalance();
					await lpToken.approve(multiFeeDistribution.address, minDLPBalance);
					await multiFeeDistribution.stake(minDLPBalance, hunter.address, 0);

					let vdWETHAddress = await leverager.getVDebtToken(weth.address);
					vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', vdWETHAddress);
					await vdWETH.connect(hunter).approveDelegation(leverager.address, ethers.constants.MaxUint256);

					await wethGateway.connect(hunter).depositETHWithAutoDLP(lendingPool.address, hunter.address, 0, {
						value: ethers.utils.parseEther('1'),
					});
				});

				it('bounty quote + claim', async () => {
					const baseBounty = toNum(await bountyManager.getBaseBounty());
					const expectedBounty = baseBounty;

					const quote = await bountyManager.quote(user1.address);
					const quotedBounty = toNum(quote.bounty);

					// NOTE: they have bounty here because their lock expired
					expect(quotedBounty).not.equals(0);
					expect(quotedBounty).closeTo(expectedBounty, 1);

					await bountyManager.connect(hunter).claim(user1.address, quote.actionType);
					const bountyReceived = toNum((await multiFeeDistribution.earnedBalances(hunter.address)).totalVesting);
					expect(bountyReceived).closeTo(quotedBounty, 0.1);
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

			describe('Market DQ:', async () => {
				let pendingAtEndOfEligibility: BigNumber;

				before(async () => {
					await loadZappedUserFixture(run);

					const isEligibleForRewardsPre = await eligibilityProvider.isEligibleForRewards(user1.address);
					const lastEligTimePre = await eligibilityProvider.lastEligibleTime(user1.address);

					// skip to earn some RDNT
					await advanceTimeAndBlock(SKIP_DURATION);
					await priceProvider.update();

					const pricePre = await priceProvider.getTokenPriceUsd();
					pendingAtEndOfEligibility = await chefIncentivesController.allPendingRewards(user1.address);
					const baseBountyPre = await bountyManager.getBaseBounty();

					let vdWETHAddress = await leverager.getVDebtToken(weth.address);
					vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', vdWETHAddress);
					await vdWETH.connect(hunter).approveDelegation(leverager.address, ethers.constants.MaxUint256);

					await wethGateway.connect(hunter).depositETHWithAutoDLP(lendingPool.address, hunter.address, 0, {
						value: ethers.utils.parseEther('1'),
					});

					let sellAmt = '800000000';
					if (deployConfig.LP_PROVIDER == LP_PROVIDER.BALANCER) {
						sellAmt = ethers.utils.formatEther(deployConfig.LP_INIT_RDNT.div(5));
					}

					await sellRdnt(sellAmt, dao, rdntToken, lockZap, priceProvider, stakingToken);
					await advanceTimeAndBlock(3601);
					await priceProvider.update();
					const pricePost = await priceProvider.getTokenPriceUsd();

					await makeHunterEligible(); // needs to be after price drop

					const baseBountyPost = await bountyManager.getBaseBounty();
					const lastEligTimePost = await eligibilityProvider.lastEligibleTime(user1.address);

					expect(pricePost).lt(pricePre);
					// price down, more base bounty RDNT
					expect(baseBountyPost).gt(baseBountyPre);

					expect(await eligibilityProvider.isEligibleForRewards(user1.address)).is.false;

					if (isEligibleForRewardsPre) {
						expect(lastEligTimePre).gt(lastEligTimePost);
					} else {
						expect(lastEligTimePre).eq(lastEligTimePost);
					}
				});

				it('bounty quote + claim', async () => {
					const quote = await bountyManager.quote(user1.address);
					const quotedBounty = toNum(quote.bounty);

					if (depositAmt === eligibleAmt) {
						const bb = toNum(await bountyManager.getBaseBounty());

						// since Market DQ, all will have BB
						expect(quotedBounty).equals(bb);

						await bountyManager.connect(hunter).claim(user1.address, quote.actionType);
						const bountyReceived = parseFloat(
							ethers.utils.formatEther((await multiFeeDistribution.earnedBalances(hunter.address)).totalVesting)
						);
						expect(bountyReceived).closeTo(quotedBounty, 0.001);
					} else {
						expect(quotedBounty).equals(0);
					}
				});

				it('doesnt earn emish', async () => {
					const pendingPre = await chefIncentivesController.allPendingRewards(user1.address);
					await advanceTimeAndBlock(DEFAULT_LOCK_TIME);
					const pendingPost = await chefIncentivesController.allPendingRewards(user1.address);
					// was DQd, shouldnt earn
					expect(pendingPre).equals(pendingPost);
				});
			});

			describe('While Eligible: bounty = 0, cant claim:', async () => {
				before(async () => {
					await loadZappedUserFixture(run);
					await advanceTimeAndBlock(SKIP_DURATION);
				});

				it('bounty quote + claim', async () => {
					if (depositAmt == eligibleAmt) {
						const quote = toNum((await bountyManager.quote(user1.address)).bounty);
						expect(quote).equals(0);
						await expect(bountyManager.connect(hunter).claim(user1.address)).to.be.reverted;
						// ).to.be.revertedWith("user still eligible");
					}
				});
			});

			describe('run w/ 0 funded bounties, doesnt work, v1', async function () {
				before(async function () {
					// console.log('           reset to zap fixture');
				});
				it('dq test', function () {
					expect(1).equals(1);
				});
			});
		});
	});
});
