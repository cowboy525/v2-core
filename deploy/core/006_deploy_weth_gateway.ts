import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getConfigForChain} from '../../config/index';
import {getWeth} from '../../scripts/getDepenencies';
import {getTxnOpts} from '../../scripts/deploy/helpers/getTxnOpts';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy, execute, read} = deployments;
	const {deployer, admin} = await getNamedAccounts();
	const {baseAssetWrapped} = getConfigForChain(await hre.getChainId());
	const txnOpts = await getTxnOpts(hre);

	const {weth} = await getWeth(hre);
	const wethAddr = weth.address;

	const lendingPool = await read('LendingPoolAddressesProvider', 'getLendingPool');

	await deploy('WETHGateway', {
		...txnOpts,
		args: [wethAddr],
	});

	await execute('WETHGateway', txnOpts, 'authorizeLendingPool', lendingPool);
};
export default func;
func.tags = ['core'];
