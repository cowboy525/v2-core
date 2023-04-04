import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, network, getNamedAccounts} = hre;

	// TODO: handle this better w/ test. this should not run during local/test
	// if (!network.live) return;

	const {execute} = deployments;
	const {deployer, admin} = await getNamedAccounts();

	await execute(
		'RadiantOFT',
		{
			from: deployer,
			log: true,
		},
		'transferOwnership',
		admin
	);
};
export default func;
func.tags = ['oft'];
