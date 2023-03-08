import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getConfigForChain } from '../config/index';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();
	const { baseAssetWrapped } = getConfigForChain(await hre.getChainId());
	const weth = await deployments.get(baseAssetWrapped);

	const uniswapV2Factory = await deploy('UniswapV2Factory', {
		from: deployer,
		log: true,
		args: [
			deployer
		]
	});

	await deploy('UniswapV2Router02', {
		from: deployer,
		log: true,
		args: [
			uniswapV2Factory.address,
			weth.address
		]
	});
};
export default func;
func.tags = ['core'];
