import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getConfigForChain} from '../../config/index';
import {network} from 'hardhat';
import {getWeth, wait} from '../../scripts/getDepenencies';
import {LP_PROVIDER} from '../../scripts/deploy/types';
import {getTxnOpts} from '../../scripts/deploy/helpers/getTxnOpts';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy, execute, read} = deployments;
	const {deployer} = await getNamedAccounts();
	const {config} = getConfigForChain(await hre.getChainId());
	const txnOpts = await getTxnOpts(hre);

	let poolHelper = await deployments.get('PoolHelper');
	const stakingAddress = await read('PoolHelper', 'lpTokenAddr');
	let radiantToken = await deployments.get('RadiantOFT');
	const {chainlinkEthUsd} = await getWeth(hre);

	let oracle;
	if (network.tags.oracle_v3) {
		const pair2 = '0x2334d412da299a21486b663d12c392185b313aaa';
		const fallbackPair = '0x24704aff49645d32655a76df6d407e02d146dafc';

		oracle = await deploy('UniV3TwapOracle', {
			...txnOpts,
			contract: 'UniV3TwapOracle',
			proxy: {
				proxyContract: 'OpenZeppelinTransparentProxy',
				execute: {
					methodName: 'initialize',
					args: [pair2, radiantToken.address, chainlinkEthUsd, 60],
				},
			},
		});
		let fallback = await deploy('UniV2TwapOracle', {
			...txnOpts,
			proxy: {
				proxyContract: 'OpenZeppelinTransparentProxy',
				execute: {
					methodName: 'initialize',
					args: [fallbackPair, radiantToken.address, chainlinkEthUsd, config.TWAP_PERIOD, 30, true],
				},
			},
		});
		if (fallback.newlyDeployed) {
			await execute('UniV3TwapOracle', {from: deployer, log: true}, 'setFallback', fallback.address);
			await execute('UniV2TwapOracle', {from: deployer, log: true}, 'update');
		}
	}

	if (network.tags.oracle_v2) {
		oracle = await deploy('UniV2TwapOracle', {
			...txnOpts,
			contract: 'UniV2TwapOracle',
			proxy: {
				proxyContract: 'OpenZeppelinTransparentProxy',
				execute: {
					methodName: 'initialize',
					args: [stakingAddress, radiantToken.address, chainlinkEthUsd, config.TWAP_PERIOD, 120, true],
				},
			},
		});
		await wait(config.TWAP_PERIOD);
		await execute('UniV2TwapOracle', {from: deployer, log: true}, 'update');
	}

	if (network.tags.oracle_cl) {
		// ARBI
		const rdntClFeed = '0x20d0Fcab0ECFD078B036b6CAf1FaC69A6453b352';
		const ethClFeed = config.CHAINLINK_ETH_USD_AGGREGATOR_PROXY;
		oracle = await deploy('ChainlinkV3Adapter', {
			...txnOpts,
			contract: 'ChainlinkV3Adapter',
			proxy: {
				proxyContract: 'OpenZeppelinTransparentProxy',
				execute: {
					methodName: 'initialize',
					args: [radiantToken.address, ethClFeed, rdntClFeed],
				},
			},
		});
	}

	if (oracle?.newlyDeployed) {
		await execute('PriceProvider', {from: deployer, log: true}, 'setUsePool', false);
		await execute('PriceProvider', {from: deployer, log: true}, 'setOracle', oracle.address);
	}
};
export default func;
func.tags = ['oracle'];
