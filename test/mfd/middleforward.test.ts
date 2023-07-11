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

	it('Deposit and borrow by User 2 + 3, Lock DLPs', async () => {
		await zapIntoEligibility(user2, deployData);

		await USDC.mint(user2.address, usdcPerAccount);
		await USDC.mint(user3.address, usdcPerAccount);

		await USDC.connect(user2).approve(lendingPool.address, ethers.constants.MaxUint256);
		await radiantToken.connect(user2).approve(multiFeeDistribution.address, ethers.constants.MaxUint256);

		await USDC.connect(user3).approve(lendingPool.address, ethers.constants.MaxUint256);
		await radiantToken.connect(user3).approve(multiFeeDistribution.address, ethers.constants.MaxUint256);

		await lendingPool.connect(user2).deposit(usdcAddress, usdcPerAccount, user2.address, 0);

		await lendingPool.connect(user3).deposit(usdcAddress, usdcPerAccount, user3.address, 0);

		await lendingPool.connect(user3).borrow(usdcAddress, borrowAmt, 2, 0, user3.address);

		const bal = Number(await rUSDC.balanceOf(user2.address));
		assert.notEqual(bal, 0, `Has balance`);
	});

	it('Earns RDNT on Lend/Borrow', async () => {
		await advanceTimeAndBlock(duration / 10);
		const vestableRdnt = await chef.pendingRewards(user2.address, deployData.allTokenAddrs);

		const balances = _.without(
			vestableRdnt.map((bn) => Number(bn)),
			0
		);
		assert.equal(balances.length, 1, `Earned Rewards`);
	});

	it('User2 can Vest RDNT', async () => {
		await chef.claim(user2.address, deployData.allTokenAddrs);
		await advanceTimeAndBlock(deployConfig.MFD_VEST_DURATION);

		const {amount: mfdRewardAmount, penaltyAmount: penalty0} = await multiFeeDistribution.withdrawableBalance(
			user2.address
		);
		assert.notEqual(mfdRewardAmount, 0, `Can exit w/ rdnt`);
		assert.equal(penalty0, 0, `no penalty`);
	});

	it('Send RDNT to MiddleFeeDistribution', async () => {
		await middleFeeDistribution.setOperationExpenses(user2.address, 0);
		const earnings0 = await multiFeeDistribution.earnedBalances(user2.address);

		// Forward current reward
		await multiFeeDistribution.connect(user2).getAllRewards();

		// Release all current rewards
		const rewardDuration = await multiFeeDistribution.rewardsDuration();
		await advanceTimeAndBlock(rewardDuration.toNumber());

		// Forward reward, notify rewards on MFD
		const forwardAmount = ethers.utils.parseEther("10000");
		await radiantToken.connect(dao).transfer(middleFeeDistribution.address, forwardAmount);
		await multiFeeDistribution.connect(user2).getAllRewards();

		// Earnings not increased
		const earnings1 = await multiFeeDistribution.earnedBalances(user2.address);
		expect(earnings1.length).to.be.equal(earnings0.length);

		// Forwarded rewards should be fully withdrawable
		await advanceTimeAndBlock(rewardDuration.toNumber());

		const rdnt0 = await radiantToken.balanceOf(user2.address);
		await multiFeeDistribution.connect(user2).getAllRewards();
		const rdnt1 = await radiantToken.balanceOf(user2.address);
		// consider rounding
		expect(rdnt1.sub(rdnt0)).to.be.gt(forwardAmount.sub(10));
		expect(rdnt1.sub(rdnt0)).to.be.lt(forwardAmount.add(10));
	});
});
