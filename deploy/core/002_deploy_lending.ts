import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'deploy_lending',
	tags: ['core', 'lending'],
	dependencies: ['weth'],
});
let func = step.setFunction(async function () {
	const {deploy, weth} = step;

	const lendingPoolAddressesProviderRegistry = await deploy('LendingPoolAddressesProviderRegistry');

	const lendingPoolAddressesProvider = await deploy('LendingPoolAddressesProvider', {
		args: ['Radiant'],
	});

	// Deploy libraries used by lending pool implementation, ReserveLogic
	const reserveLogic = await deploy('ReserveLogic');

	// Deploy libraries used by lending pool implementation, GenericLogic
	const genericLogic = await deploy('GenericLogic');

	// Deploy libraries used by lending pool implementation, ValidationLogic
	const validationLogic = await deploy('ValidationLogic', {
		libraries: {
			GenericLogic: genericLogic.address,
		},
	});

	const libraries = {
		'contracts/lending/libraries/logic/ValidationLogic.sol:ValidationLogic': validationLogic.address,
		'contracts/lending/libraries/logic/ReserveLogic.sol:ReserveLogic': reserveLogic.address,
	};

	let lendingPool = await deploy('LendingPool', {
		libraries: {
			ValidationLogic: validationLogic.address,
			ReserveLogic: reserveLogic.address,
		},
	});

	// // LendingPool (InitializableImmutableAdminUpgradeabilityProxy)
	let lendingPoolConfigurator = await deploy('LendingPoolConfigurator', {
		libraries: {
			ValidationLogic: validationLogic.address,
			ReserveLogic: reserveLogic.address,
		},
	});

	await deploy('StableAndVariableTokensHelper', {
		args: [lendingPool.address, lendingPoolAddressesProvider.address],
	});

	await deploy('AToken');

	await deploy('StableDebtToken');

	await deploy('VariableDebtToken');

	await deploy('WETHGateway', {
		args: [weth.address],
	});
});
export default func;
