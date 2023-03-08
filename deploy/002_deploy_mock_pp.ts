import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts, network } = hre;
	const { deploy, execute, read } = deployments;
	const { deployer } = await getNamedAccounts();

	// TODO: handle this better w/ test. this should not run during local/test
	if (!network.live) return;

	let pp = await deploy('MockPriceProvider', {
		from: deployer,
		log: true,
		waitConfirmations: 1,
		skipIfAlreadyDeployed: true,
	});
	if (pp.newlyDeployed) {
		await execute("RadiantOFT", { from: deployer, log: true }, "setPriceProvider", pp.address);
	}
};
export default func;
func.tags = ['rdnt'];
