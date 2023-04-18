import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import assert from 'assert';
import {ethers, upgrades} from 'hardhat';
import _ from 'lodash';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
import {DeployData} from '../../scripts/deploy/types';
import {ChefIncentivesController} from '../../typechain';
import {setupTest} from '../setup';

chai.use(solidity);

describe('Upgradeable Contracts', () => {
	let deployData: DeployData;
	let chefIncentivesController: ChefIncentivesController;
	let deployer: SignerWithAddress;

	before(async () => {
		const fixture = await setupTest();
		deployData = fixture.deployData;
		deployer = fixture.deployer;

		chefIncentivesController = fixture.chefIncentivesController;

		const ChefIncentivesController = await ethers.getContractFactory('ChefIncentivesController');
		const MiddleFeeDistribution = await ethers.getContractFactory('MiddleFeeDistribution');
		const MultiFeeDistribution = await ethers.getContractFactory('MultiFeeDistribution');
		const PriceProvider = await ethers.getContractFactory('PriceProvider');

		await upgrades.forceImport(deployData.chefIncentivesController, ChefIncentivesController);
		await upgrades.forceImport(deployData.middleFeeDistribution, MiddleFeeDistribution);
		await upgrades.forceImport(deployData.multiFeeDistribution, MultiFeeDistribution);
		await upgrades.forceImport(deployData.priceProvider, PriceProvider);
	});

	it('Upgradeable ChefIncentivesController works.', async () => {
		const newRps = ethers.utils.parseUnits('42', 18);
		await chefIncentivesController.connect(deployer).setRewardsPerSecond(newRps, true);
		const rps1 = await chefIncentivesController.rewardsPerSecond();

		const MockNewChefIncentivesController = await ethers.getContractFactory('MockNewChefIncentivesController');
		const mockNewChefIncentivesController = await upgrades.upgradeProxy(
			deployData.chefIncentivesController,
			MockNewChefIncentivesController
		);
		const mockNewFunction = await mockNewChefIncentivesController.mockNewFunction();

		const rps2 = await mockNewChefIncentivesController.rewardsPerSecond();

		assert.equal(mockNewFunction, true, `Upgrade ChefIncentivesController`);
		assert.equal(rps1.toString(), rps2.toString(), 'Data persists post-upgrade');
	});

	it('Upgradeable MiddleFeeDistribution works.', async () => {
		const MockNewMiddleFeeDistribution = await ethers.getContractFactory('MockNewMiddleFeeDistribution');
		const mockNewMiddleFeeDistribution = await upgrades.upgradeProxy(
			deployData.middleFeeDistribution,
			MockNewMiddleFeeDistribution
		);
		const mockNewFunction = await mockNewMiddleFeeDistribution.mockNewFunction();

		assert.equal(mockNewFunction, true, `Upgrade MiddleFeeDistribution`);
	});

	it('Upgradeable MFD works.', async () => {
		const MockNewMultiFeeDistribution = await ethers.getContractFactory('MockNewMultiFeeDistribution');
		const mockNewMultiFeeDistribution = await upgrades.upgradeProxy(
			deployData.multiFeeDistribution,
			MockNewMultiFeeDistribution
		);
		const mockNewFunction = await mockNewMultiFeeDistribution.mockNewFunction();

		assert.equal(mockNewFunction, true, `Upgrade MultiFeeDistribution`);
	});

	it('Upgradeable PriceProvider works.', async () => {
		const MockNewPriceProvider = await ethers.getContractFactory('MockNewPriceProvider');
		const mockNewPriceProvider = await upgrades.upgradeProxy(deployData.priceProvider, MockNewPriceProvider);
		const mockNewFunction = await mockNewPriceProvider.mockNewFunction();

		assert.equal(mockNewFunction, true, `Upgrade PriceProvider`);
	});
});
