import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getConfigForChain} from '../../config';
import {wait} from '../../scripts/getDepenencies';
import {getTxnOpts} from '../../scripts/deploy/helpers/getTxnOpts';
const {ethers} = require('hardhat');

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy, read, execute} = deployments;
	const {deployer, treasury} = await getNamedAccounts();
	const {config} = getConfigForChain(await hre.getChainId());
	const txnOpts = await getTxnOpts(hre);

	let rdntRequired = config.LP_INIT_RDNT.add(config.SUPPLY_CIC_RESERVE).add(config.SUPPLY_DQ_RESERVE);

	if (!!config.SUPPLY_MIGRATION_MINT) {
		rdntRequired = rdntRequired.add(config.SUPPLY_MIGRATION_MINT);
	}

	let deployerBalance = await read('RadiantOFT', 'balanceOf', deployer);
	// console.log(`=== Deployer will need RDNT: `, ethers.utils.formatEther(rdntRequired));
	// console.log(`--- has: `, ethers.utils.formatEther(deployerBalance));
	if (rdntRequired.gt(deployerBalance)) {
		console.log(`======= STOP NOW =======`);
		throw new Error('deployer short');
	}

	const lendingPoolAddressesProviderRegistryDep = await deploy('LendingPoolAddressesProviderRegistry', txnOpts);

	const lendingPoolAddressesProviderDep = await deploy('LendingPoolAddressesProvider', {
		...txnOpts,
		args: ['Radiant'],
	});

	if (lendingPoolAddressesProviderDep.newlyDeployed) {
		const lendingPoolAddressesProviderRegistry = await ethers.getContractAt(
			'LendingPoolAddressesProviderRegistry',
			lendingPoolAddressesProviderRegistryDep.address
		);
		const lendingPoolAddressesProvider = await ethers.getContractAt(
			'LendingPoolAddressesProvider',
			lendingPoolAddressesProviderDep.address
		);

		// Set the provider at the Registry
		await (
			await lendingPoolAddressesProviderRegistry.registerAddressesProvider(
				lendingPoolAddressesProvider.address,
				'1'
			)
		).wait();

		// Set pool admins
		await (await lendingPoolAddressesProvider.setPoolAdmin(deployer)).wait();
		await (await lendingPoolAddressesProvider.setEmergencyAdmin(deployer)).wait();

		await (await lendingPoolAddressesProvider.setLiquidationFeeTo(treasury)).wait();

		// Deploy libraries used by lending pool implementation, ReserveLogic
		const reserveLogic = await deploy('ReserveLogic', txnOpts);

		// Deploy libraries used by lending pool implementation, GenericLogic
		const genericLogic = await deploy('GenericLogic', txnOpts);

		// Deploy libraries used by lending pool implementation, ValidationLogic
		const validationLogic = await deploy('ValidationLogic', {
			...txnOpts,
			libraries: {
				GenericLogic: genericLogic.address,
			},
		});

		const libraries = {
			'contracts/lending/libraries/logic/ValidationLogic.sol:ValidationLogic': validationLogic.address,
			'contracts/lending/libraries/logic/ReserveLogic.sol:ReserveLogic': reserveLogic.address,
		};

		let lendingPool = await deploy('LendingPool', {
			...txnOpts,
			libraries: {
				ValidationLogic: validationLogic.address,
				ReserveLogic: reserveLogic.address,
			},
		});

		await execute('LendingPool', txnOpts, 'initialize', lendingPoolAddressesProvider.address);

		await (await lendingPoolAddressesProvider.setLendingPoolImpl(lendingPool.address)).wait();

		await wait(5);

		// // LendingPool (InitializableImmutableAdminUpgradeabilityProxy)
		let lendingPoolConfigurator = await deploy('LendingPoolConfigurator', {
			...txnOpts,
			libraries: {
				ValidationLogic: validationLogic.address,
				ReserveLogic: reserveLogic.address,
			},
		});

		await (
			await lendingPoolAddressesProvider.setLendingPoolConfiguratorImpl(lendingPoolConfigurator.address)
		).wait();

		// // LendingPoolConfigurator (InitializableImmutableAdminUpgradeabilityProxy)
		const lendingPoolConfiguratorProxy = (await ethers.getContract('LendingPoolConfigurator')).attach(
			await lendingPoolAddressesProvider.getLendingPoolConfigurator()
		);
		await (await lendingPoolConfiguratorProxy.setPoolPause(true)).wait();
	}
};
export default func;
