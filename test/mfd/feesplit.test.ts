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

		await zapIntoEligibility(deployer, deployData);
	});

	it('Deposit and borrow by User 2 + 3', async () => {
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

	it('Both receives platform fees, also opEx receives interest', async () => {
		await lendingPool.connect(user3).repay(usdcAddress, borrowAmt, 2, user3.address);
		await advanceTimeAndBlock(REWARDS_DURATION);

		const length = 5;
		const aTokens = [];
		for (let i = 0; i < length; i += 1) {
			aTokens.push(await multiFeeDistribution.rewardTokens(i));
		}

		const aTokenBalance = [];
		const lpBalances0 = [];
		const mfdBalances0 = [];

		for (let i = 0; i < length; i += 1) {
			const rewardToken = await ethers.getContractAt('ERC20', aTokens[i]);
			aTokenBalance.push(await rewardToken.balanceOf(middleFeeDistribution.address));
			lpBalances0.push(await rewardToken.balanceOf(multiFeeDistribution.address));
			mfdBalances0.push(await rewardToken.balanceOf(multiFeeDistribution.address));
		}
		await multiFeeDistribution.getReward(aTokens);
		await advanceTimeAndBlock(REWARDS_DURATION);
		for (let i = 0; i < length; i += 1) {
			const rewardToken = await ethers.getContractAt('ERC20', aTokens[i]);

			const lpBalance = await rewardToken.balanceOf(multiFeeDistribution.address);
			const lpRewards = lpBalance.sub(lpBalances0[i]);

			const opExBalance = await rewardToken.balanceOf(opEx.address);

			const opExRewards = aTokenBalance[i].mul(opRatio).div(1e4);
			const expectedLPRewards = aTokenBalance[i].sub(opExRewards);

			// balance no change cuz deployer not staked
			expect(opExBalance).to.be.equal(opExRewards);
			expect(expectedLPRewards.toNumber()).to.be.approximately(lpRewards.toNumber(), 5); //.to.be.equal(lpData.balance);
		}
	});

	it('Can exit and get RDNT', async () => {
		await radiantToken.connect(user2).transfer(dao.address, await radiantToken.balanceOf(user2.address));
		const bal = await getRdntBal(radiantToken, user2);
		assert.equal(Number(bal), 0, `User 2 has no RDNT yet`);

		await multiFeeDistribution.connect(user2).exit(true);
		const bal0 = await getRdntBal(radiantToken, user2);
		assert.equal(bal0.gt(0), true, `Got RDNT on exit`);
	});
});
