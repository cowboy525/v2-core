import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import chai from 'chai';
import assert from 'assert';
import {ethers, upgrades} from 'hardhat';
import {advanceTimeAndBlock} from '../shared/helpers';
import {AToken, ChefIncentivesController, LendingPool, MockOnwardIncentivesController, MockToken} from '../../typechain';
import {getLatestBlockTimestamp} from '../../scripts/utils';
import {BigNumber} from 'ethers';
import {setupTest} from '../setup';
import {solidity} from 'ethereum-waffle';
import { DeployData } from '../../scripts/deploy/types';

chai.use(solidity);
const {expect} = chai;


describe('ChefIncentivesController Rewards Schedule and Manual Setting RPS.', () => {
	let deployer: SignerWithAddress;
	let chefIncentivesController: ChefIncentivesController;
	let deployData: DeployData;
	let lendingPool: LendingPool;
	let USDC: MockToken;
	let rUSDC: AToken;
	let onwardIncentiveController: MockOnwardIncentivesController;

	let usdcAddress = '';
	let rUSDCAddress = '';
	
	const rewardsPerSecond = ethers.utils.parseUnits('1', 18);
	const usdcPerAccount = ethers.utils.parseUnits('1000000000', 6);
	const depositAmt = ethers.utils.parseUnits('10000', 6);

	before(async () => {
		const fixture = await setupTest();

		deployer = fixture.deployer;

		deployData = fixture.deployData;

		usdcAddress = fixture.usdc.address;
		rUSDCAddress = deployData.allTokens.rUSDC;

		const onwardIncentiveControllerFactory = await ethers.getContractFactory('MockOnwardIncentivesController');
		onwardIncentiveController = await onwardIncentiveControllerFactory.deploy();
		await onwardIncentiveController.deployed();
		chefIncentivesController = fixture.chefIncentivesController;
		lendingPool = fixture.lendingPool;

		USDC = <MockToken>await ethers.getContractAt('MockToken', usdcAddress);
		rUSDC = <AToken>await ethers.getContractAt('AToken', rUSDCAddress);

		await chefIncentivesController.setEligibilityEnabled(false);
		await chefIncentivesController.setOnwardIncentives(rUSDCAddress, onwardIncentiveController.address);
		await USDC.mint(deployer.address, usdcPerAccount);
		await USDC.approve(lendingPool.address, ethers.constants.MaxUint256);
		await lendingPool.deposit(usdcAddress, depositAmt, deployer.address, 0);
	});

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

		assert.equal(rps, newRPS, `manual rewards setting`);
	});

	it('scheulded rewards', async () => {
		const startTime = await chefIncentivesController.startTime();
		const now = await getLatestBlockTimestamp();
		const offset = now - startTime.toNumber();

		const cicStartTimeOffSets = [offset + 100, offset + 500, offset + 1000];
		const cicRewardsPerSecond = [100, 200, 300];

		await expect(chefIncentivesController.connect(deployer).setEmissionSchedule([], [])).to.be.reverted;

		await expect(chefIncentivesController.connect(deployer).setEmissionSchedule([0], [100])).to.be.reverted;

		await expect(chefIncentivesController.start()).to.be.reverted;

		await chefIncentivesController.connect(deployer).setEmissionSchedule(cicStartTimeOffSets, cicRewardsPerSecond);

		await advanceTimeAndBlock(100);

		await chefIncentivesController.claimAll(deployer.address);
		assert.equal((await chefIncentivesController.emissionScheduleIndex()).toString(), '1', `get rps from schedule`);
		await advanceTimeAndBlock(100);
		await chefIncentivesController.claimAll(deployer.address);
		assert.equal(
			(await chefIncentivesController.rewardsPerSecond()).toString(),
			cicRewardsPerSecond[0].toString(),
			`get rps from schedule`
		);

		await advanceTimeAndBlock(400);

		await chefIncentivesController.connect(deployer).setRewardsPerSecond(100, false);

		await chefIncentivesController.claimAll(deployer.address);
		assert.equal((await chefIncentivesController.emissionScheduleIndex()).toString(), '2', `get rps from schedule`);
		assert.equal(
			(await chefIncentivesController.rewardsPerSecond()).toString(),
			cicRewardsPerSecond[1].toString(),
			`get rps from schedule`
		);

		await advanceTimeAndBlock(500);

		await chefIncentivesController.claimAll(deployer.address);
		assert.equal((await chefIncentivesController.emissionScheduleIndex()).toString(), '3', `get rps from schedule`);
		assert.equal(
			(await chefIncentivesController.rewardsPerSecond()).toString(),
			cicRewardsPerSecond[2].toString(),
			`get rps from schedule`
		);
	});

	it('validates all starttime offsets', async () => {
		const startTime = await chefIncentivesController.startTime();
		const now = await getLatestBlockTimestamp();
		const offset = now - startTime.toNumber();

		let cicStartTimeOffSets = [offset + 100, 0, 0];
		const cicRewardsPerSecond = [100, 200, 300];

		await expect(
			chefIncentivesController.connect(deployer).setEmissionSchedule(cicStartTimeOffSets, cicRewardsPerSecond)
		).to.be.reverted;

		cicStartTimeOffSets = [offset + 100, offset + 200, 0];

		await expect(
			chefIncentivesController.connect(deployer).setEmissionSchedule(cicStartTimeOffSets, cicRewardsPerSecond)
		).to.be.reverted;
	});

	it('reverts on time offsets > the max uint128', async () => {
		const startTime = await chefIncentivesController.startTime();
		const now = await getLatestBlockTimestamp();
		const offset = now - startTime.toNumber();
		const maxUint128 = ethers.BigNumber.from('340282366920938463463374607431768211455');

		let cicStartTimeOffSets = [offset + 100, maxUint128.add(1), offset + 300];
		const cicRewardsPerSecond = [100, 200, 300];

		await expect(
			chefIncentivesController.connect(deployer).setEmissionSchedule(cicStartTimeOffSets, cicRewardsPerSecond)
		).to.be.reverted;

		cicStartTimeOffSets = [offset + 100, offset + 200, maxUint128.add(1)];

		await expect(
			chefIncentivesController.connect(deployer).setEmissionSchedule(cicStartTimeOffSets, cicRewardsPerSecond)
		).to.be.reverted;

		cicStartTimeOffSets = [offset + 100, offset + 200, maxUint128];

		await expect(
			chefIncentivesController.connect(deployer).setEmissionSchedule(cicStartTimeOffSets, cicRewardsPerSecond)
		).to.not.be.reverted;
	});

	it('reverts on rewardsPerSecond > the max uint128', async () => {
		const startTime = await chefIncentivesController.startTime();
		const now = await getLatestBlockTimestamp();
		const offset = now - startTime.toNumber();
		const maxUint128 = ethers.BigNumber.from('340282366920938463463374607431768211455');

		const cicStartTimeOffSets = [offset + 100, offset + 200, offset + 300];
		let cicRewardsPerSecond = [100, maxUint128.add(1), 300];

		await expect(
			chefIncentivesController.connect(deployer).setEmissionSchedule(cicStartTimeOffSets, cicRewardsPerSecond)
		).to.be.reverted;

		cicRewardsPerSecond = [100, 200, maxUint128.add(1)];

		await expect(
			chefIncentivesController.connect(deployer).setEmissionSchedule(cicStartTimeOffSets, cicRewardsPerSecond)
		).to.be.reverted;

		cicRewardsPerSecond = [100, 200, maxUint128];

		await expect(
			chefIncentivesController.connect(deployer).setEmissionSchedule(cicStartTimeOffSets, cicRewardsPerSecond)
		).to.not.be.reverted;
	});

	it('ensure rps is set by schedule once time has passed', async () => {
		const skipDuration = 100;
		// - launch everything w/ fixed rewards per second, skip some time, ensure is correct
		const newRPS = 1000;
		await chefIncentivesController.setRewardsPerSecond(newRPS, false);
		advanceTimeAndBlock(skipDuration);
		let rps = await chefIncentivesController.rewardsPerSecond();
		assert.equal(rps, newRPS, `manual rewards setting`);

		// - pass a schedule w/ 1 entry, starting a few mins away from current time. sets rewards per sec to a massively different value
		const startTime = await chefIncentivesController.startTime();
		const now = await getLatestBlockTimestamp();
		const offset = now - startTime.toNumber();
		const cicStartTimeOffSets = [offset + skipDuration / 2];
		let cicRewardsPerSecond = [newRPS * newRPS];
		await expect(
			chefIncentivesController.connect(deployer).setEmissionSchedule(cicStartTimeOffSets, cicRewardsPerSecond)
		).to.not.be.reverted;
		rps = await chefIncentivesController.rewardsPerSecond();
		assert.equal(rps, newRPS, `manual rewards setting`);

		// - once that time passed, do a claim, ensure rewards per sec has changed
		const prevIndex = await chefIncentivesController.emissionScheduleIndex();
		const prevRPS = await chefIncentivesController.rewardsPerSecond();
		advanceTimeAndBlock(skipDuration);
		await chefIncentivesController.claimAll(deployer.address);
		assert.notEqual(await chefIncentivesController.emissionScheduleIndex(), prevIndex, `get rps from schedule`);
		assert.notEqual(await chefIncentivesController.rewardsPerSecond(), prevRPS, `get rps from schedule`);
	});
});
