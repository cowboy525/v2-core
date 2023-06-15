import {ethers, upgrades} from 'hardhat';
import {loadFixture} from '@nomicfoundation/hardhat-network-helpers';
import {advanceTimeAndBlock, getLatestBlockTimestamp} from '../../scripts/utils';
import _ from 'lodash';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
import {zapIntoEligibility, deployAndSetup, toJsNum} from '../shared/helpers';
import {DeployConfig, DeployConfigOverride, DeployData} from '../../scripts/deploy/types';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {
	AToken,
	ChefIncentivesController,
	CustomERC20,
	LendingPool,
	MockToken,
	MultiFeeDistribution,
} from '../../typechain';
import {BigNumberish} from 'ethers';
import assert from 'assert';
import {MockOnwardIncentivesController} from '../../typechain/contracts/test/MockOnwardIncentivesController';
import {setupTest} from '../setup';

chai.use(solidity);
const {expect} = chai;

function customFixture(configOverrides: DeployConfigOverride = {}) {
	const uniqueNameHere = () => {
		return deployAndSetup(configOverrides);
	};
	return uniqueNameHere;
}

describe('Non-Elig CIC', () => {
	let deployer: SignerWithAddress;
	let user1: SignerWithAddress;
	let deployData: DeployData;
	let deployConfig: DeployConfig;
	let USDC: MockToken;
	let rUSDC: AToken;
	let onwardIncentiveController: MockOnwardIncentivesController;

	let chefIncentivesController: ChefIncentivesController;
	let lendingPool: LendingPool;
	let multiFeeDistribution: MultiFeeDistribution;

	let usdcAddress = '';
	let rUSDCAddress = '';

	const rewardsPerSecond = ethers.utils.parseUnits('1', 18);
	const usdcPerAccount = ethers.utils.parseUnits('1000000000', 6);
	const depositAmt = ethers.utils.parseUnits('10000', 6);

	let period: number;

	before(async () => {
		// USE WITH DEFAULT CONFIG
		// const fixture = await loadFixture(deployAndSetup);

		// const fixture = await loadFixture(
		//   customFixture({
		//     CIC_RPS: ethers.utils.parseUnits(rewardsPerSecond.toString(), 18),
		//   })
		// );

		const fixture = await setupTest();

		const onwardIncentiveControllerFactory = await ethers.getContractFactory('MockOnwardIncentivesController');
		onwardIncentiveController = await onwardIncentiveControllerFactory.deploy();
		await onwardIncentiveController.deployed();

		deployData = fixture.deployData;
		deployConfig = fixture.deployConfig;

		user1 = fixture.user1;
		deployer = fixture.deployer;

		usdcAddress = fixture.usdc.address;
		rUSDCAddress = deployData.allTokens.rUSDC;

		chefIncentivesController = fixture.chefIncentivesController;
		multiFeeDistribution = fixture.multiFeeDistribution;
		lendingPool = fixture.lendingPool;

		USDC = <MockToken>await ethers.getContractAt('MockToken', usdcAddress);
		rUSDC = <AToken>await ethers.getContractAt('AToken', rUSDCAddress);

		await chefIncentivesController.setEligibilityEnabled(false);
		await chefIncentivesController.setOnwardIncentives(rUSDCAddress, onwardIncentiveController.address);
		await USDC.mint(user1.address, usdcPerAccount);
		await USDC.connect(user1).approve(lendingPool.address, ethers.constants.MaxUint256);

		period = (await multiFeeDistribution.defaultLockDuration()).div(10).toNumber();
	});

	describe('addPool requires', () => {
		it('should be callable by only pool configurator', async () => {
			const chefFactory = await ethers.getContractFactory('ChefIncentivesController');
			const chef = await upgrades.deployProxy(
				chefFactory,
				[
					deployer.address,
					deployer.address, // Mock address
					deployData.middleFeeDistribution,
					100,
				],
				{initializer: 'initialize'}
			);
			await chef.deployed();

			await expect(chef.connect(user1).addPool(user1.address, 10)).to.be.reverted;

			await chef.addPool(deployData.allTokens['rUSDC'], 10);
			await expect(chef.addPool(deployData.allTokens['rUSDC'], 10)).to.be.reverted;
			expect(await chef.poolLength()).to.be.gte(1);
		});
	});

	describe('handleActionAfter', () => {
		it("can't called from non-pool", async () => {
			await expect(chefIncentivesController.handleActionAfter(user1.address, 10, 10)).to.be.reverted;
		});
	});

	describe('batchUpdateAllocPoint', () => {
		it('length must match', async () => {
			await expect(chefIncentivesController.batchUpdateAllocPoint([user1.address], [])).to.be.reverted;
		});

		it('non existing pool', async () => {
			await expect(chefIncentivesController.batchUpdateAllocPoint([user1.address], [10])).to.be.reverted;
		});
	});

	it('setOnwardIncentives', async () => {
		await expect(
			chefIncentivesController.connect(user1).setOnwardIncentives(
				rUSDCAddress,
				ethers.constants.AddressZero // random address
			)
		).to.be.revertedWith('Ownable: caller is not the owner');
		await expect(
			chefIncentivesController.setOnwardIncentives(
				user1.address, // random address
				ethers.constants.AddressZero // random address
			)
		).to.be.reverted;
		await chefIncentivesController.setOnwardIncentives(rUSDCAddress, onwardIncentiveController.address);
	});

	describe('setRewardsPerSecond callable', () => {
		it('should be callable by only owner', async () => {
			await expect(
				chefIncentivesController.connect(user1).setRewardsPerSecond(rewardsPerSecond, true)
			).to.be.revertedWith('Ownable: caller is not the owner');

			await expect(chefIncentivesController.connect(deployer).setRewardsPerSecond(rewardsPerSecond, false)).to.be
				.not.reverted;

			await expect(chefIncentivesController.connect(deployer).setRewardsPerSecond(rewardsPerSecond, true)).to.be
				.not.reverted;
		});
	});

	describe('check persist rewards per second in a single pool', () => {
		let user1mount = ethers.utils.parseUnits('100', 18);
		let totalSupply = ethers.utils.parseUnits('10000', 18);
		let allocPoint: BigNumberish;
		let totalAllocPoint: BigNumberish;

		it('Deposit by User 1', async () => {
			await zapIntoEligibility(user1, deployData, '100');

			await lendingPool.connect(user1).deposit(usdcAddress, depositAmt.div(2), user1.address, 0);
			await lendingPool.connect(user1).deposit(usdcAddress, depositAmt.div(2), user1.address, 0);

			const poolInfo = await chefIncentivesController.poolInfo(rUSDCAddress);
			totalSupply = poolInfo.totalSupply;
			const userInfo = await chefIncentivesController.userInfo(rUSDCAddress, user1.address);
			user1mount = userInfo.amount;

			totalAllocPoint = await chefIncentivesController.totalAllocPoint();
			allocPoint = poolInfo.allocPoint;
		});

		it('claimable rewards should be calculated in seconds', async () => {
			const claimableRewards0 = await chefIncentivesController.pendingRewards(user1.address, [rUSDCAddress]);

			await advanceTimeAndBlock(period);

			const claimableRewards1 = await chefIncentivesController.pendingRewards(user1.address, [rUSDCAddress]);
			const allReward = await chefIncentivesController.allPendingRewards(user1.address);

			const expectedRewards = rewardsPerSecond
				.mul(period + 1)
				.mul(allocPoint)
				.div(totalAllocPoint)
				.mul(user1mount)
				.div(totalSupply);

			const rewardDelta = claimableRewards1[0].sub(claimableRewards0[0]);
			const rewardDeltaNum = parseFloat(ethers.utils.formatEther(rewardDelta));
			const expectedRewardsNum = parseFloat(ethers.utils.formatEther(expectedRewards));

			expect(rewardDeltaNum).to.be.approximately(expectedRewardsNum, 0.5);
			expect(toJsNum(claimableRewards1[0])).to.be.approximately(toJsNum(allReward), 1);
		});

		it('claimable rewards should be updated with rewards per seconds', async () => {
			const claimableRewards0 = await chefIncentivesController.pendingRewards(user1.address, [rUSDCAddress]);

			// mine 100 seconds
			await advanceTimeAndBlock(period);

			// snapshot claimable rewards
			const claimableRewards1 = await chefIncentivesController.pendingRewards(user1.address, [rUSDCAddress]);

			// increase rewards as 3 times
			const times = 3;
			const rewardsPerSecond2 = rewardsPerSecond.mul(times);
			await chefIncentivesController.connect(deployer).setRewardsPerSecond(rewardsPerSecond2, true);

			const claimableRewards2 = await chefIncentivesController.pendingRewards(user1.address, [rUSDCAddress]);

			// mine 100 seconds again
			await advanceTimeAndBlock(period);

			// snapshot increased claimable rewards
			const claimableRewards3 = await chefIncentivesController.pendingRewards(user1.address, [rUSDCAddress]);

			// new rewards should be increased 3 times, but not by mined period
			const prevRewards = claimableRewards1[0].sub(claimableRewards0[0]).mul(times);
			const newRewards = claimableRewards3[0].sub(claimableRewards2[0]);
			expect(parseFloat(ethers.utils.formatEther(newRewards))).to.be.approximately(
				parseFloat(ethers.utils.formatEther(prevRewards)),
				20
			);
		});

		it('claim for middlefeedistribution', async () => {
			await expect(chefIncentivesController.claim(deployData.middleFeeDistribution, deployData.allTokenAddrs)).to
				.be.not.reverted;
		});

		it('should claim rewards', async () => {
			// mine 100 seconds
			await advanceTimeAndBlock(period);

			const balanceBefore = (await multiFeeDistribution.earnedBalances(user1.address)).totalVesting;

			const claimableRewards = await chefIncentivesController.pendingRewards(user1.address, [rUSDCAddress]);

			/**
			 * NOTE: calling `external` function will mine new block, means when calls
			 * `claim` function requires mining a new block, so rewards will be more
			 * for one block.
			 * so the return value of `claimableRewards` and claimed amount in `claim`
			 * will be different.
			 **/
			await chefIncentivesController.setRewardsPerSecond(ethers.utils.parseUnits('1', 34), true);
			await advanceTimeAndBlock(500);
			await expect(chefIncentivesController.connect(user1).claim(user1.address, [user1.address])).to.be.reverted;
			await chefIncentivesController.connect(user1).claimAll(user1.address);

			const balanceAfter = (await multiFeeDistribution.earnedBalances(user1.address)).totalVesting;

			expect(balanceAfter.sub(balanceBefore)).to.be.gt(claimableRewards[0]);
		});

		it('withdraw all', async () => {
			const amount = await rUSDC.balanceOf(user1.address);
			await lendingPool.connect(user1).setUserUseReserveAsCollateral(usdcAddress, false);
			await lendingPool.connect(user1).withdraw(usdcAddress, amount, user1.address);
		});
	});

	it("can't start again", async () => {
		await expect(chefIncentivesController.start()).to.be.reverted;
	});

	describe('ChefIncentivesController Rewards Schedule and Manual Setting RPS.', () => {
		it('setEmissionSchedule before start', async () => {
			const chefFactory = await ethers.getContractFactory('ChefIncentivesController');
			const chef = await upgrades.deployProxy(
				chefFactory,
				[
					deployer.address, // Mock address
					deployer.address, // Mock address
					deployer.address, // Mock address
					100,
				],
				{initializer: 'initialize'}
			);
			await chef.deployed();

			const cicStartTimeOffSets = [100, 500, 1000];
			const cicRewardsPerSecond = [100, 200, 300];
			await chef.connect(deployer).setEmissionSchedule(cicStartTimeOffSets, cicRewardsPerSecond);
		});

		it('manually set rewards', async () => {
			const newRPS = 1000;

			await chefIncentivesController.setRewardsPerSecond(newRPS, false);

			const rps = await chefIncentivesController.rewardsPerSecond();

			expect(rps).to.be.equal(newRPS, `manual rewards setting`);
		});

		it('scheulded rewards', async () => {
			const startTime = await chefIncentivesController.startTime();
			const startTimeOffset = (await getLatestBlockTimestamp()) - startTime.toNumber();

			const cicStartTimeOffSets = [startTimeOffset + 100, startTimeOffset + 500, startTimeOffset + 1000];
			const cicRewardsPerSecond = [100, 200, 300];

			await expect(chefIncentivesController.connect(deployer).setEmissionSchedule([], [])).to.be.reverted;

			await expect(chefIncentivesController.connect(deployer).setEmissionSchedule([0], [100])).to.be.reverted;

			await expect(chefIncentivesController.start()).to.be.reverted;

			await chefIncentivesController
				.connect(deployer)
				.setEmissionSchedule(cicStartTimeOffSets, cicRewardsPerSecond);

			await advanceTimeAndBlock(100);

			await chefIncentivesController.claim(user1.address, [rUSDCAddress]);
			assert.equal(
				(await chefIncentivesController.emissionScheduleIndex()).toString(),
				'1',
				`get rps from schedule`
			);
			await chefIncentivesController.claim(user1.address, [rUSDCAddress]);
			assert.equal(
				(await chefIncentivesController.rewardsPerSecond()).toString(),
				cicRewardsPerSecond[0].toString(),
				`get rps from schedule`
			);

			await advanceTimeAndBlock(400);

			await chefIncentivesController.connect(deployer).setRewardsPerSecond(100, false);

			await chefIncentivesController.claimAll(user1.address);
			assert.equal(
				(await chefIncentivesController.emissionScheduleIndex()).toString(),
				'2',
				`get rps from schedule`
			);
			assert.equal(
				(await chefIncentivesController.rewardsPerSecond()).toString(),
				cicRewardsPerSecond[1].toString(),
				`get rps from schedule`
			);

			await advanceTimeAndBlock(500);

			await chefIncentivesController.claim(user1.address, [rUSDCAddress]);
			assert.equal(
				(await chefIncentivesController.emissionScheduleIndex()).toString(),
				'3',
				`get rps from schedule`
			);
			assert.equal(
				(await chefIncentivesController.rewardsPerSecond()).toString(),
				cicRewardsPerSecond[2].toString(),
				`get rps from schedule`
			);
		});
	});

	it('registerRewardDeposit', async () => {
		await chefIncentivesController.setRewardsPerSecond(0, true);
		await chefIncentivesController.registerRewardDeposit(1000);
		expect(await chefIncentivesController.rewardsPerSecond()).to.be.equal(await chefIncentivesController.lastRPS());
	});

	it('recover ERC20', async () => {
		const mintAmount = ethers.utils.parseUnits('604800', 18);
		const erc20Factory = await ethers.getContractFactory('CustomERC20');
		const mockErc20 = <CustomERC20>await erc20Factory.deploy(mintAmount);
		await mockErc20.mint(chefIncentivesController.address, mintAmount);
		expect(await mockErc20.balanceOf(chefIncentivesController.address)).to.be.equal(mintAmount);
		const balance = await mockErc20.balanceOf(deployer.address);
		await chefIncentivesController.recoverERC20(mockErc20.address, mintAmount);
		expect(await mockErc20.balanceOf(deployer.address)).to.be.equal(balance.add(mintAmount));
	});
});
