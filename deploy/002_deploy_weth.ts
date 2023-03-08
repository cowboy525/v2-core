import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getConfigForChain } from '../config/index';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();
	const { baseAssetWrapped } = getConfigForChain(await hre.getChainId());

	await deploy(baseAssetWrapped, {
		from: deployer,
		log: true,
	});
};
// TODO: dont do this in prod
func.tags = ['core'];

export default func;
