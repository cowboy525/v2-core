import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import assert from 'assert';
import {ethers} from 'hardhat';
import {advanceTimeAndBlock} from '../../scripts/utils';
import {
	ChefIncentivesController,
	LendingPool,
	MultiFeeDistribution,
	MiddleFeeDistribution,
	MockERC20,
	MockToken,
	RadiantOFT,
} from '../../typechain';
import _ from 'lodash';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
import {DeployConfig, DeployData} from '../../scripts/deploy/types';
import {getRdntBal, zapIntoEligibility} from '../shared/helpers';
import {setupTest} from '../setup';

import {loadFixture} from '@nomicfoundation/hardhat-network-helpers';
chai.use(solidity);
const {expect} = chai;

describe('MFDs split Platform Revenue', () => {
	let deployer: SignerWithAddress;
	let user2: SignerWithAddress;
	let user3: SignerWithAddress;
	let dao: SignerWithAddress;
	let opEx: SignerWithAddress;

	let USDC: MockToken;

	let rUSDC: MockERC20;
	let lendingPool: LendingPool;
	let chef: ChefIncentivesController;
	let middleFeeDistribution: MiddleFeeDistribution;
	let multiFeeDistribution: MultiFeeDistribution;
	let radiantToken: RadiantOFT;

	const usdcPerAccount = ethers.utils.parseUnits('10000', 6);
	const borrowAmt = ethers.utils.parseUnits('1000', 6);
	const opRatio = 1000;

	// REPLACED w/ real values from MFD.
	// const REWARDS_DURATION = oneDay * 7;
	// const duration = oneDay * 30;
	let REWARDS_DURATION = 0;
	let duration = 0;

	let deployData: DeployData;
	let deployConfig: DeployConfig;
	let usdcAddress = '';

	before(async () => {
		const fixture = await setupTest();

		deployData = fixture.deployData;
		deployConfig = fixture.deployConfig;

		deployer = fixture.deployer;
		user2 = fixture.user2;
		user3 = fixture.user3;
		opEx = fixture.user4;
		dao = fixture.dao;

		usdcAddress = fixture.usdc.address;
		USDC = <MockToken>await ethers.getContractAt('MockToken', usdcAddress);
		rUSDC = <MockERC20>await ethers.getContractAt('mockERC20', deployData.allTokens.rUSDC);

		lendingPool = fixture.lendingPool;
		chef = fixture.chefIncentivesController;
		multiFeeDistribution = fixture.multiFeeDistribution;
		multiFeeDistribution = fixture.multiFeeDistribution;
		middleFeeDistribution = fixture.middleFeeDistribution;
		radiantToken = fixture.rdntToken;

		REWARDS_DURATION = (await multiFeeDistribution.rewardsDuration()).toNumber();
		duration = (await multiFeeDistribution.defaultLockDuration()).toNumber();

		await middleFeeDistribution.setOperationExpenses(opEx.address, opRatio);
	});

	it('Deposit and borrow by User 2 + 3, Zap into elgibility', async () => {
		await USDC.mint(user2.address, usdcPerAccount);
		await USDC.mint(user3.address, usdcPerAccount);
		await USDC.connect(user2).approve(lendingPool.address, ethers.constants.MaxUint256);
		await USDC.connect(user3).approve(lendingPool.address, ethers.constants.MaxUint256);
		await lendingPool.connect(user2).deposit(usdcAddress, usdcPerAccount, user2.address, 0);
		await lendingPool.connect(user3).deposit(usdcAddress, usdcPerAccount, user3.address, 0);
		await lendingPool.connect(user3).borrow(usdcAddress, borrowAmt, 2, 0, user3.address);
		const bal = Number(await rUSDC.balanceOf(user2.address));
		assert.notEqual(bal, 0, `Has balance`);

		await zapIntoEligibility(user2, deployData);
	});

	it('User2 starts to vest tokens', async () => {
		await advanceTimeAndBlock(duration / 10);
		const vestableRdnt = await chef.pendingRewards(user2.address, deployData.allTokenAddrs);
		const claimableRdnt = vestableRdnt.reduce((a, b) => a.add(b));
		expect(claimableRdnt).to.be.gt(0);

		await chef.claim(user2.address, deployData.allTokenAddrs);

		const {totalVesting: earningAmount} = await multiFeeDistribution.earnedBalances(
			user2.address
		);
		expect(earningAmount).to.be.gt(claimableRdnt);
	});

	it('Rewards get transferred from MiddleFee to MultiFee.', async () => {
		await middleFeeDistribution.setOperationExpenses(user2.address, 0);
		const forwardAmount = ethers.utils.parseEther("10000");
		await radiantToken.connect(dao).transfer(middleFeeDistribution.address, forwardAmount);

		const {totalVesting: earningAmount0} = await multiFeeDistribution.earnedBalances(
			user2.address
		);
		const [rdntRewardData] = await multiFeeDistribution.claimableRewards(user2.address)
		const rewardAmount0 = rdntRewardData.amount;
		const middleBalance0 = await radiantToken.balanceOf(middleFeeDistribution.address);
		const multiBalance0 = await radiantToken.balanceOf(multiFeeDistribution.address);

		// just forward
		await multiFeeDistribution.getReward([radiantToken.address]);

		const {totalVesting: earningAmount1} = await multiFeeDistribution.earnedBalances(
			user2.address
		);
		const [rdntRewardData1] = await multiFeeDistribution.claimableRewards(user2.address)
		const rewardAmount1 = rdntRewardData1.amount;
		const middleBalance1 = await radiantToken.balanceOf(middleFeeDistribution.address);
		const multiBalance1 = await radiantToken.balanceOf(multiFeeDistribution.address);

		expect(multiBalance1.sub(multiBalance0)).to.be.equal(middleBalance0);
		expect(middleBalance1).to.be.equal(0);

		// Check that pending vesting and revenue rewards are as expected.
		expect(earningAmount0).to.be.equal(earningAmount1);
		expect(rewardAmount1).to.be.gte(rewardAmount0);
	});

	it('Rewards get transferred from MiddleFee to MultiFee. 2nd forward', async () => {
		await advanceTimeAndBlock(REWARDS_DURATION);
		const forwardAmount = ethers.utils.parseEther("10000");
		await radiantToken.connect(dao).transfer(middleFeeDistribution.address, forwardAmount);

		const {totalVesting: earningAmount0} = await multiFeeDistribution.earnedBalances(
			user2.address
		);
		const [rdntRewardData] = await multiFeeDistribution.claimableRewards(user2.address)
		const rewardAmount0 = rdntRewardData.amount;
		const middleBalance0 = await radiantToken.balanceOf(middleFeeDistribution.address);
		const multiBalance0 = await radiantToken.balanceOf(multiFeeDistribution.address);

		// just forward
		await multiFeeDistribution.getReward([radiantToken.address]);

		const {totalVesting: earningAmount1} = await multiFeeDistribution.earnedBalances(
			user2.address
		);
		const [rdntRewardData1] = await multiFeeDistribution.claimableRewards(user2.address)
		const rewardAmount1 = rdntRewardData1.amount;
		const middleBalance1 = await radiantToken.balanceOf(middleFeeDistribution.address);
		const multiBalance1 = await radiantToken.balanceOf(multiFeeDistribution.address);

		// Check that pending vesting and revenue rewards are as expected.
		expect(multiBalance1.sub(multiBalance0)).to.be.equal(middleBalance0);
		expect(middleBalance1).to.be.equal(0);
		expect(earningAmount0).to.be.equal(earningAmount1);
		expect(rewardAmount1).to.be.equal(rewardAmount0);
	});

	it("User withdraws some of the revenue rewards", async () => {
		const {totalVesting: earningAmount0} = await multiFeeDistribution.earnedBalances(
			user2.address
		);
		const [rdntRewardData0] = await multiFeeDistribution.claimableRewards(user2.address)
		const rewardAmount0 = rdntRewardData0.amount;
		const userBal0 = await radiantToken.balanceOf(user2.address);

		await multiFeeDistribution.connect(user2).getAllRewards();

		const {totalVesting: earningAmount1} = await multiFeeDistribution.earnedBalances(
			user2.address
		);
		const [rdntRewardData1] = await multiFeeDistribution.claimableRewards(user2.address)
		const rewardAmount1 = rdntRewardData1.amount;
		const userBal1 = await radiantToken.balanceOf(user2.address);

		// Check that pending vesting rewards are as still as expected.
		expect(earningAmount1).to.be.equal(earningAmount0);
		expect(rewardAmount1).to.be.equal(0);
		expect(userBal1.sub(userBal0)).to.be.gte(rewardAmount0); // one block rewards more distributed
	});

	it("User withdraws some of the finished vested rewards", async () => {
		await advanceTimeAndBlock(duration);

		const {unlocked: withdrawable0} = await multiFeeDistribution.earnedBalances(
			user2.address
		);
		const [rdntRewardData0] = await multiFeeDistribution.claimableRewards(user2.address)
		const rewardAmount0 = rdntRewardData0.amount;
		const userBal0 = await radiantToken.balanceOf(user2.address);

		await multiFeeDistribution.connect(user2).withdraw(withdrawable0);

		const {unlocked: withdrawable1} = await multiFeeDistribution.earnedBalances(
			user2.address
		);
		const [rdntRewardData1] = await multiFeeDistribution.claimableRewards(user2.address)
		const rewardAmount1 = rdntRewardData1.amount;
		const userBal1 = await radiantToken.balanceOf(user2.address);

		// Check that the pending revenue rewards are still as expected.
		expect(rewardAmount1).to.be.equal(rewardAmount0);
		expect(withdrawable1).to.be.equal(0);
		expect(userBal1.sub(userBal0)).to.be.equal(withdrawable0);
	});
});
