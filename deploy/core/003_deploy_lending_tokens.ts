import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getConfigForChain} from '../config/index';
import {getTxnOpts} from '../../scripts/deploy/helpers/getTxnOpts';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy, read} = deployments;
	const {deployer} = await getNamedAccounts();
	const txnOpts = await getTxnOpts(hre);

	const lendingPool = await read('LendingPoolAddressesProvider', 'getLendingPool');
	const lendingPoolConfigurator = await read('LendingPoolAddressesProvider', 'getLendingPoolConfigurator');
	let lendingPoolAddressesProvider = await deployments.get('LendingPoolAddressesProvider');

	await deploy('StableAndVariableTokensHelper', {
		...txnOpts,
		args: [lendingPool, lendingPoolAddressesProvider.address],
	});

	await deploy('ATokensAndRatesHelper', {
		...txnOpts,
		args: [lendingPool, lendingPoolAddressesProvider.address, lendingPoolConfigurator],
	});

	await deploy('AToken', txnOpts);

	await deploy('StableDebtToken', txnOpts);

	await deploy('VariableDebtToken', txnOpts);
};
export default func;
func.tags = ['core'];
