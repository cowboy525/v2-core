import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
const {ethers} = require('hardhat');
import {getConfigForChain} from '../../config/index';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy, execute, read} = deployments;
	const {deployer, dao} = await getNamedAccounts();
	const {config} = getConfigForChain(await hre.getChainId());

	const edp = await deployments.get(`EligibilityDataProvider`);
	const middleFeeDistribution = await deployments.get(`MiddleFeeDistribution`);
	const LendingPoolConfiguratorImpl = await ethers.getContractFactory('LendingPoolConfigurator');
	const lendingPoolConfiguratorProxy = LendingPoolConfiguratorImpl.attach(
		await read('LendingPoolAddressesProvider', 'getLendingPoolConfigurator')
	);

	const cic = await deploy('ChefIncentivesController', {
		from: deployer,
		log: true,
		proxy: {
			proxyContract: 'OpenZeppelinTransparentProxy',
			execute: {
				init: {
					methodName: 'initialize',
					args: [
						lendingPoolConfiguratorProxy.address,
						edp.address,
						middleFeeDistribution.address,
						config.CIC_RPS,
					],
				},
			},
		},
	});

	if (cic.newlyDeployed) {
		await execute('ChefIncentivesController', {from: deployer, log: true}, 'start');
		await execute('RadiantOFT', {from: deployer, log: true}, 'transfer', cic.address, config.SUPPLY_CIC_RESERVE);
		await execute(
			'ChefIncentivesController',
			{from: deployer, log: true},
			'registerRewardDeposit',
			config.SUPPLY_CIC_RESERVE
		);
		await execute(
			'EligibilityDataProvider',
			{from: deployer, log: true},
			'setChefIncentivesController',
			cic.address
		);
		await execute(`ChefIncentivesController`, {from: deployer, log: true}, 'setEndingTimeUpdateCadence', 86400);
	}
};
export default func;
func.tags = ['core'];
