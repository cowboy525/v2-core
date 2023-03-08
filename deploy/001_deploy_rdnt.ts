import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getConfigForChain } from '../config';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const { deployments, getNamedAccounts } = hre;
	const { deploy, execute } = deployments;
	const { deployer, treasury, dao } = await getNamedAccounts();
	const { config } = getConfigForChain(await hre.getChainId());

	let rdnt = await deploy('RadiantOFT', {
		from: deployer,
		log: true,
		waitConfirmations: 1,
		skipIfAlreadyDeployed: true,
		args: [
			config.TOKEN_NAME,
			config.SYMBOL,
			config.LZ_ENDPOINT,
			dao,
			treasury,
			config.MINT_AMT
		]
	});
	if (rdnt.newlyDeployed) {
		await execute("RadiantOFT", { from: deployer, log: true }, "setFee", config.FEE_BRIDGING);
	}
};
func.tags = ['core', 'rdnt'];
export default func;
