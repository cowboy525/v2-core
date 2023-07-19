import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getWeth} from '../../scripts/getDepenencies';
import {getTxnOpts} from '../../scripts/deploy/helpers/getTxnOpts';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy, execute, read} = deployments;
	const txnOpts = await getTxnOpts(hre);

	const {weth} = await getWeth(hre);
	const wethAddr = weth.address;

	const lendingPool = await read('LendingPoolAddressesProvider', 'getLendingPool');

	let gateway = await deploy('WETHGateway', {
		...txnOpts,
		skipIfAlreadyDeployed: true,
		args: [wethAddr],
	});
	if (gateway.newlyDeployed) {
		await execute('WETHGateway', txnOpts, 'authorizeLendingPool', lendingPool);
	}
};
export default func;
func.tags = ['core'];
