import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import hre, {ethers, upgrades} from 'hardhat';
import {advanceTimeAndBlock, getLatestBlockTimestamp} from '../../scripts/utils';
import {ChefIncentivesController, CustomERC20, MultiFeeDistribution} from '../../typechain';
import HardhatDeployConfig from '../../config/31337';
import {setupTest} from '../setup';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
chai.use(solidity);
const {expect} = chai;

describe('CIC Basic functionalties', () => {
	let preTestSnapshotID: any;

	let deployer: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let treasury: SignerWithAddress;

	let cic: ChefIncentivesController;

	beforeEach(async () => {
		preTestSnapshotID = await hre.network.provider.send('evm_snapshot');

		[deployer, user1, user2, treasury] = await ethers.getSigners();

		const cicFactory = await ethers.getContractFactory('ChefIncentivesController');
		cic = <ChefIncentivesController>await upgrades.deployProxy(
			cicFactory,
			[
				deployer.address, // pool configurator
				deployer.address, // EDP, mock value
				deployer.address, // rewardMinter, mock value
				1000, // RPS
			],
			{initializer: 'initialize', unsafeAllow: ['constructor']}
		);
		await cic.deployed();
	});

	it('init params validation', async () => {
		const cicFactory = await ethers.getContractFactory('ChefIncentivesController');
		await expect(
			upgrades.deployProxy(
				cicFactory,
				[
					ethers.constants.AddressZero, // pool configurator
					deployer.address, // EDP, mock value
					deployer.address, // rewardMinter, mock value
					1000, // RPS
				],
				{initializer: 'initialize', unsafeAllow: ['constructor']}
			)
		).to.be.reverted;
		await expect(
			upgrades.deployProxy(
				cicFactory,
				[
					deployer.address, // pool configurator
					ethers.constants.AddressZero, // EDP, mock value
					deployer.address, // rewardMinter, mock value
					1000, // RPS
				],
				{initializer: 'initialize', unsafeAllow: ['constructor']}
			)
		).to.be.reverted;
		await expect(
			upgrades.deployProxy(
				cicFactory,
				[
					deployer.address, // pool configurator
					deployer.address, // EDP, mock value
					ethers.constants.AddressZero, // rewardMinter, mock value
					1000, // RPS
				],
				{initializer: 'initialize', unsafeAllow: ['constructor']}
			)
		).to.be.reverted;
	});

	describe('owner permission', async () => {
		it('setBountyManager', async () => {
			await expect(cic.connect(user1).setBountyManager(deployer.address)).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
		});

		it('setEligibilityEnabled', async () => {
			await expect(cic.connect(user1).setEligibilityEnabled(true)).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
		});

		it('start', async () => {
			await expect(cic.connect(user1).start()).to.be.revertedWith('Ownable: caller is not the owner');
		});

		it('batchUpdateAllocPoint', async () => {
			await expect(cic.connect(user1).batchUpdateAllocPoint([], [])).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
		});

		it('setEmissionSchedule', async () => {
			await expect(cic.connect(user1).setEmissionSchedule([], [])).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
		});

		it('setLeverager', async () => {
			await expect(cic.connect(user1).setLeverager(deployer.address)).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
		});

		it('setEligibilityExempt', async () => {
			await expect(cic.connect(user1).setEligibilityExempt(deployer.address, true)).to.be.revertedWith(
				'InsufficientPermission'
			);
		});

		it('setEndingTimeUpdateCadence', async () => {
			await expect(cic.connect(user1).setEndingTimeUpdateCadence(10)).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
		});

		it('registerRewardDeposit', async () => {
			await expect(cic.connect(user1).registerRewardDeposit(10)).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
		});

		it('claimBounty', async () => {
			await expect(cic.connect(user1).claimBounty(deployer.address, true)).to.be.reverted;
		});

		it('recoverERC20', async () => {
			await expect(cic.connect(user1).recoverERC20(deployer.address, 10)).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
		});
	});

	it('setEndingTimeUpdateCadence: Cadence Too long', async () => {
		await expect(cic.setEndingTimeUpdateCadence(1000000)).to.be.reverted;
	});

	describe('pause/unpause', async () => {
		it('owner permission', async () => {
			await expect(cic.connect(user1).pause()).to.be.revertedWith('Ownable: caller is not the owner');
			await expect(cic.connect(user1).unpause()).to.be.revertedWith('Ownable: caller is not the owner');
			await cic.pause();
			await cic.unpause();
		});

		it('functions when not paused', async () => {
			await cic.pause();
			await expect(cic.connect(user1).claimAll(user1.address)).to.be.revertedWith('Pausable: paused');
		});
	});

	it('batchUpdateAllocPoint', async () => {
		await expect(cic.batchUpdateAllocPoint([deployer.address], [10])).to.be.reverted;
	});

	afterEach(async () => {
		await hre.network.provider.send('evm_revert', [preTestSnapshotID]);
	});
});
