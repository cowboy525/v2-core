import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {ethers} from 'hardhat';
import {advanceTimeAndBlock} from '../../scripts/utils';
import {
	BountyManager,
	LendingPool,
	MultiFeeDistribution,
	ERC20,
	VariableDebtToken,
	Leverager,
	WETH,
	WETHGateway,
	Compounder,
	EligibilityDataProvider,
	PriceProvider,
	MiddleFeeDistribution,
	CustomERC20,
} from '../../typechain';
import _ from 'lodash';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
import {DeployData} from '../../scripts/deploy/types';
import {loadFixture} from '@nomicfoundation/hardhat-network-helpers';
import {BigNumber} from 'ethers';
import {HOUR} from '../../config/constants';
import {deposit, doBorrow, toNum, zap} from './helpers';
import {setupTest} from '../setup';

chai.use(solidity);
const {expect} = chai;

let multiFeeDistribution: MultiFeeDistribution;
let eligibilityProvider: EligibilityDataProvider;
let middleFeeDistribution: MiddleFeeDistribution;
let compounder: Compounder;
let lendingPool: LendingPool;
let leverager: Leverager;
let wethGateway: WETHGateway;
let weth: WETH;
let priceProvider: PriceProvider;
let deployData: DeployData;
let user1: SignerWithAddress;
let user2: SignerWithAddress;
let hunter: SignerWithAddress;
let vdWETH: VariableDebtToken;
let deployer: SignerWithAddress;
let DEFAULT_LOCK_TIME: number;
let LOCK_DURATION: number;
let SKIP_DURATION: number;
let bountyManager: BountyManager;
let lpToken: ERC20;
let rdntToken: CustomERC20;
let usdc: CustomERC20;

const eligibleAmt = 1000000;
const acceptableUserSlippage = 9500;

const generatePlatformRevenue = async (duration: number = SKIP_DURATION) => {
	await deposit('rWETH', '20000', deployer, lendingPool, deployData);

	await doBorrow('rWETH', '10000', deployer, lendingPool, deployData);

	await advanceTimeAndBlock(duration);

	await doBorrow('rWETH', '1', deployer, lendingPool, deployData);

	await multiFeeDistribution.connect(deployer).getAllRewards();
	await advanceTimeAndBlock(duration);
};

const generateGiganticPlatformRevenue = async (duration: number = SKIP_DURATION) => {
	await deposit('rWBTC', '90000000000000000000000000000000000', deployer, lendingPool, deployData);

	await doBorrow('rWBTC', '20000000000000000000000000000000000', deployer, lendingPool, deployData);

	await advanceTimeAndBlock(duration);

	await doBorrow('rWBTC', '100000', deployer, lendingPool, deployData);

	await multiFeeDistribution.connect(deployer).getAllRewards();
	await advanceTimeAndBlock(duration);
};

const zapAndDeposit = async (defaultLockTime: number, depositAmt: number) => {
	// await multiFeeDistribution.connect(user1).setRelock(relock);
	await multiFeeDistribution.connect(user1).setDefaultRelockTypeIndex(defaultLockTime);
	await deposit('rUSDC', depositAmt.toString(), user1, lendingPool, deployData);
	await zap(user1, deployData, true, defaultLockTime);

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

const loadZappedUserFixture = async () => {
	({
		multiFeeDistribution,
		eligibilityProvider,
		middleFeeDistribution,
		lendingPool,
		leverager,
		weth,
		wethGateway,
		priceProvider,
		deployData,
		LOCK_DURATION,
		compounder,
		bountyManager,
		user1,
		user2,
		deployer,
		rdntToken,
		usdc,
	} = await setupTest());

	hunter = user2;
	DEFAULT_LOCK_TIME = LOCK_DURATION;
	SKIP_DURATION = DEFAULT_LOCK_TIME / 20;
	lpToken = await ethers.getContractAt('ERC20', deployData.stakingToken);

	// Deposit assets
	await deposit('rWETH', '10000', deployer, lendingPool, deployData);
	await zapAndDeposit(0, eligibleAmt);
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

const getPendingInRdnt = async (): Promise<number> => {
	const rdntPriceInEth = parseFloat(ethers.utils.formatUnits(await priceProvider.getTokenPrice(), 8));
	const pending1 = await multiFeeDistribution.claimableRewards(user1.address);
	const pendingWeth = pending1.filter((entry) => entry.token === deployData.allTokens['rWETH'])[0].amount;
	const pendingInRdnt = parseFloat(ethers.utils.formatEther(pendingWeth)) / rdntPriceInEth;
	const acFee = 0.03;
	const hunterShare = 0.3;
	const expectedFee = pendingInRdnt * acFee * hunterShare;
	return expectedFee;
};

describe(`AutoCompound:`, async () => {
	let pendingWeth: BigNumber;

	before(async () => {
		await loadZappedUserFixture();
		await makeHunterEligible();
		await multiFeeDistribution.connect(user1).setAutocompound(true, acceptableUserSlippage);
	});

	it('no bounty when no platform rev', async () => {
		const quote = await bountyManager.connect(hunter).quote(user1.address);
		// let quote = await bountyManager.connect(hunter).executeBounty(user1.address, false, 0);
		expect(toNum(quote.bounty)).equals(0);
	});

	it('earns platform revenue', async () => {
		await generatePlatformRevenue();
		const pending1 = await multiFeeDistribution.claimableRewards(user1.address);
		pendingWeth = pending1.filter((entry) => entry.token === deployData.allTokens['rWETH'])[0].amount;
		expect(pendingWeth).gt(0);
	});

	it('has bounty quote when over autocompound threshold', async () => {
		const quote = await bountyManager.connect(hunter).quote(user1.address);
		const expectedFee = await getPendingInRdnt();
		expect(parseFloat(ethers.utils.formatEther(quote.bounty))).closeTo(expectedFee, 0.5);
	});

	it('can claim bounty', async () => {
		const lockInfo0 = await multiFeeDistribution.lockedBalances(user1.address);
		expect(lockInfo0.lockData.length).to.be.equal(1);

		const expectedFee = await getPendingInRdnt();
		const quote = await bountyManager.connect(hunter).quote(user1.address);

		await bountyManager.connect(hunter).claim(user1.address, quote.actionType);

		const bountyReceived = toNum((await multiFeeDistribution.earnedBalances(hunter.address)).totalVesting);
		expect(bountyReceived).closeTo(expectedFee, 0.5);

		const lockInfo1 = await multiFeeDistribution.lockedBalances(user1.address);
		expect(lockInfo1.lockData.length).to.be.equal(2);
	});

	it('quote goes to zero after claim, is 0 until re-elig', async () => {
		const quote = await bountyManager.quote(user1.address);
		expect(quote.bounty).equals(0);
	});

	it('quote still 0 w/ rev, but !wait 24 hours', async () => {
		await generatePlatformRevenue(1 * HOUR);
		const quote = await bountyManager.quote(user1.address);
		expect(toNum(quote.bounty)).equals(0);
	});

	it('quote > 0 after 24 hours pass', async () => {
		await advanceTimeAndBlock(24 * HOUR);
		await generatePlatformRevenue();
		const expectedFee = await getPendingInRdnt();
		const quote = await bountyManager.quote(user1.address);
		expect(toNum(quote.bounty)).closeTo(expectedFee, 50);
	});

	it('cant AC user who has not enabled', async () => {
		await multiFeeDistribution.connect(user1).setAutocompound(false, acceptableUserSlippage);
		await expect(bountyManager.connect(hunter).claim(user1.address)).to.be.reverted;
		await multiFeeDistribution.connect(user1).setAutocompound(true, acceptableUserSlippage);
	});

	it('fails when slippage too high', async () => {
		await multiFeeDistribution.connect(user1).setAutocompound(true, 9999);
		await generatePlatformRevenue(1 * HOUR);
		await expect(compounder.connect(user1).claimCompound(user1.address, true)).to.be.revertedWith(
			'SlippageTooHigh'
		);
		await multiFeeDistribution.connect(user1).setAutocompound(true, acceptableUserSlippage);
	});

	it('can selfcompound for no Fee', async () => {
		await generatePlatformRevenue(1 * HOUR);
		let fee = await compounder.connect(user1).claimCompound(user1.address, false);
		expect(fee.value).to.be.equal(0);

		await generatePlatformRevenue(1 * HOUR);
		fee = await compounder.connect(user1).claimCompound(user1.address, true);
		expect(fee.value).to.be.equal(0);
	});

	it('Add USDC as Reward and Not Stuck in Compounder', async () => {
		const amount = BigNumber.from('10000000');
		await middleFeeDistribution.addReward(usdc.address);
		const rewardBaseTokens = [];
		for (let i = 0; ; i++) {
			try {
				const token = await compounder.rewardBaseTokens(i);
				rewardBaseTokens.push(token);
			} catch (e) {
				break;
			}
		}
		rewardBaseTokens.push(usdc.address);
		await compounder.addRewardBaseTokens(rewardBaseTokens);
		await usdc.mint(multiFeeDistribution.address, amount);
		await generatePlatformRevenue(1 * HOUR);

		await compounder.connect(user1).selfCompound();
		expect(await usdc.balanceOf(compounder.address)).equal(BigNumber.from('0'));
	});

	it('swap failed', async () => {
		const quote = await bountyManager.connect(hunter).quote(user1.address);
		await generateGiganticPlatformRevenue();

		await expect(bountyManager.connect(hunter).claim(user1.address, quote.actionType)).to.be.revertedWith(
			'SwapFailed'
		);
	});
});
