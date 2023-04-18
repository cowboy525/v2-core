import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {getConfigForChain} from '../../../config';

export const getTxnOpts = async (hre: HardhatRuntimeEnvironment) => {
	const {deployments, getNamedAccounts, ethers} = hre;
	const {deploy, execute, read, get} = deployments;
	const {deployer, admin, treasury} = await getNamedAccounts();
	const {config} = getConfigForChain(await hre.getChainId());

	let waitConfirmations = 0;
	if (hre.network.live) {
		if (config.CHAIN_ID === 42161) {
			waitConfirmations = 3;
		}
		if (config.CHAIN_ID === 56) {
			waitConfirmations = 5;
		}
	}
	return {
		from: deployer,
		log: true,
		waitConfirmations,
		// autoMine: true,
	};
};
