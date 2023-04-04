import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
const {ethers} = require('hardhat');

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments} = hre;

	// TODO: better way to handle this proxy
	let lendingPoolAddressesProvider = await ethers.getContract('LendingPoolAddressesProvider');
	let LendingPoolConfiguratorImpl = await ethers.getContractFactory('LendingPoolConfigurator');
	const lendingPoolConfiguratorProxy = LendingPoolConfiguratorImpl.attach(
		await lendingPoolAddressesProvider.getLendingPoolConfigurator()
	);
	await (await lendingPoolConfiguratorProxy.setPoolPause(false)).wait();
};
export default func;
func.tags = ['core'];
