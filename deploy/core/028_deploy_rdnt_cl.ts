import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getConfigForChain} from '../../config/index';
import {network} from 'hardhat';
import {getWeth} from '../../scripts/getDepenencies';
import {LP_PROVIDER} from '../../scripts/deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy, execute, read} = deployments;
	const {deployer} = await getNamedAccounts();
	const {config} = getConfigForChain(await hre.getChainId());

	let poolHelper = await deployments.get('PoolHelper');
	const stakingAddress = await read('PoolHelper', 'lpTokenAddr');
	let radiantToken = await deployments.get('RadiantOFT');
	const {chainlinkEthUsd} = await getWeth(hre);

	const ethClFeed = config.CHAINLINK_ETH_USD_AGGREGATOR_PROXY;

	if (network.tags.rdnt_cl) {
		const rdntClFeed = '0x20d0Fcab0ECFD078B036b6CAf1FaC69A6453b352';

		let clAdaptor = await deploy('ChainlinkV3Adapter', {
			from: deployer,
			contract: 'ChainlinkV3Adapter',
			log: true,
			proxy: {
				proxyContract: 'OpenZeppelinTransparentProxy',
				execute: {
					methodName: 'initialize',
					args: [radiantToken.address, ethClFeed, rdntClFeed],
				},
			},
		});
		if (clAdaptor.newlyDeployed) {
			console.log(clAdaptor.address);
			await execute('PriceProvider', {from: deployer, log: true}, 'setOracle', clAdaptor.address);
			await execute('PriceProvider', {from: deployer, log: true}, 'setUsePool', false);
		}
	}
};
export default func;
func.tags = ['rdnt_cl'];
