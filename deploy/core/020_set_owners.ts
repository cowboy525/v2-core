import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getConfigForChain} from '../../config/index';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts, network} = hre;
	const {deploy, execute, read} = deployments;
	const {deployer, dao, treasury, admin} = await getNamedAccounts();
	const {config, baseAssetWrapped} = getConfigForChain(await hre.getChainId());

	if (network.tags.set_owners) {
		const multiFeeDistribution = await deployments.get(`MFD`);

		await execute('MFD', {from: deployer, log: true}, 'transferOwnership', admin);
		await execute('MiddleFeeDistribution', {from: deployer, log: true}, 'transferOwnership', admin);
		await execute('LendingPoolAddressesProvider', {from: deployer, log: true}, 'setPoolAdmin', admin);
		await execute('LendingPoolAddressesProvider', {from: deployer, log: true}, 'setEmergencyAdmin', admin);
		await execute('AaveOracle', {from: deployer, log: true}, 'transferOwnership', admin);
		await execute('WETHGateway', {from: deployer, log: true}, 'transferOwnership', admin);
		// await execute('Migration', {from: deployer, log: true}, 'transferOwnership', admin);
		await execute('BountyManager', {from: deployer, log: true}, 'transferOwnership', admin);
		await execute('Compounder', {from: deployer, log: true}, 'transferOwnership', admin);
		await execute('PriceProvider', {from: deployer, log: true}, 'transferOwnership', admin);
		await execute('LendingPoolAddressesProvider', {from: deployer, log: true}, 'setLiquidationFeeTo', treasury);

		await execute(
			'ChefIncentivesController',
			{from: deployer},
			'setEligibilityExempt',
			multiFeeDistribution.address
		);
		await execute('ChefIncentivesController', {from: deployer, log: true}, 'transferOwnership', admin);
	}
};
export default func;
func.tags = ['accessories2'];
