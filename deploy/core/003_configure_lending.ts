import {ethers} from 'hardhat';
import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'configure_lending',
	tags: ['core', 'lending'],
	dependencies: ['deploy_lending'],
	runOnce: true,
});
let func = step.setFunction(async function () {
	const {get, read, treasury, execute, deployer, getContract} = step;

	const lendingPoolAddressesProviderRegistry = await getContract('LendingPoolAddressesProviderRegistry');
	const lendingPoolAddressesProvider = await getContract('LendingPoolAddressesProvider');
	const configurator = await ethers.getContract('LendingPoolConfigurator');
	const lendingPool = await get('LendingPool');

	// Set the provider at the Registry
	await (
		await lendingPoolAddressesProviderRegistry.registerAddressesProvider(lendingPoolAddressesProvider.address, '1')
	).wait();

	// Set pool admins
	await (await lendingPoolAddressesProvider.setPoolAdmin(deployer)).wait();
	await (await lendingPoolAddressesProvider.setEmergencyAdmin(deployer)).wait();
	await (await lendingPoolAddressesProvider.setLiquidationFeeTo(treasury)).wait();

	await execute('LendingPool', 'initialize', lendingPoolAddressesProvider.address);
	// await execute('LendingPoolConfigurator', 'initialize', lendingPoolAddressesProvider.address);

	await (await lendingPoolAddressesProvider.setLendingPoolImpl(lendingPool.address)).wait();
	await (await lendingPoolAddressesProvider.setLendingPoolConfiguratorImpl(configurator.address)).wait();

	// // LendingPoolConfigurator (InitializableImmutableAdminUpgradeabilityProxy)
	const lendingPoolConfiguratorProxy = configurator.attach(
		await lendingPoolAddressesProvider.getLendingPoolConfigurator()
	);

	await (await lendingPoolConfiguratorProxy.setPoolPause(true)).wait();

	const pool = await read('LendingPoolAddressesProvider', 'getLendingPool');
	await execute('WETHGateway', 'authorizeLendingPool', pool);
});
export default func;
