import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const etherscanKeys: {[key: string]: string} = {
	arbitrum_goerli: 'FP2ZR7FEB8I3QV32AQSZST8G6QEN19YZCG',
	bsc_testnet: 'U2TEIUWFDIMQ1D9SX996DNQJRIA6P482XU',
	arbitrum: 'DNDKPM829V5AQD7KQT34DRRIJDA8CYQNY6',
};
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const {deployments, network, getNamedAccounts} = hre;
	const {run} = deployments;

	console.log(network);

	await run(['oft', 'verify'], {
		writeDeploymentsToFiles: true,
		// deletePreviousDeployments: true
	});

	console.log('dep done, tender');
	console.log(network.name);
	console.log(etherscanKeys[network.name]);

	// await hre.run("tenderly:verify");
	// await hre.run("tenderly:push");
	await hre.run('etherscan-verify', {
		apiKey: 'DNDKPM829V5AQD7KQT34DRRIJDA8CYQNY6',
	});
};
func.tags = ['oft-preset'];
export default func;
