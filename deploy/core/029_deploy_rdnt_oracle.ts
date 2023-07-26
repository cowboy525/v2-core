import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'deploy_rdnt_oracle',
	tags: ['core'],
	dependencies: ['lending', 'token', 'distributors'],
});
let func = step.setFunction(async function () {
	const {deploy, execute, read, config, chainlinkEthUsd} = step;

	const stakingAddress = await read('PoolHelper', 'lpTokenAddr');
	let radiantToken = await deployments.get('RadiantOFT');

	let oracle;
	if (network.tags.oracle_v3) {
		const pair2 = '0x2334d412da299a21486b663d12c392185b313aaa';
		const fallbackPair = '0x24704aff49645d32655a76df6d407e02d146dafc';

		oracle = await deploy('UniV3TwapOracle', {
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
			proxy: {
				proxyContract: 'OpenZeppelinTransparentProxy',
				execute: {
					methodName: 'initialize',
					args: [fallbackPair, radiantToken.address, chainlinkEthUsd, config.TWAP_PERIOD, 30, true],
				},
			},
		});
		if (fallback.newlyDeployed) {
			await execute('UniV3TwapOracle', 'setFallback', fallback.address);
			await execute('UniV2TwapOracle', 'update');
		}
	}

	if (network.tags.oracle_v2) {
		oracle = await deploy('UniV2TwapOracle', {
			contract: 'UniV2TwapOracle',
			proxy: {
				proxyContract: 'OpenZeppelinTransparentProxy',
				execute: {
					methodName: 'initialize',
					args: [stakingAddress, radiantToken.address, chainlinkEthUsd, config.TWAP_PERIOD, 120, true],
				},
			},
		});
	}

	if (network.tags.oracle_cl) {
		// ARBI
		const rdntClFeed = '0x20d0Fcab0ECFD078B036b6CAf1FaC69A6453b352';
		const ethClFeed = config.CHAINLINK_ETH_USD_AGGREGATOR_PROXY;
		oracle = await deploy('ChainlinkV3Adapter', {
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
});
export default func;
