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

	if (network.tags.oracle_v3) {
		const pair2 = '0x2334d412da299a21486b663d12c392185b313aaa';
		const fallbackPair = '0x24704aff49645d32655a76df6d407e02d146dafc';

		let oracle = await deploy('UniV3TwapOracle', {
			from: deployer,
			contract: 'UniV3TwapOracle',
			log: true,
			proxy: {
				proxyContract: 'OpenZeppelinTransparentProxy',
				execute: {
					methodName: 'initialize',
					args: [pair2, radiantToken.address, chainlinkEthUsd, 60],
				},
			},
		});
		let fallback = await deploy('UniV2TwapOracle', {
			from: deployer,
			log: true,
			proxy: {
				proxyContract: 'OpenZeppelinTransparentProxy',
				execute: {
					methodName: 'initialize',
					args: [fallbackPair, radiantToken.address, chainlinkEthUsd, config.TWAP_PERIOD, 30, true],
				},
			},
		});
		if (fallback.newlyDeployed) {
			console.log(fallback.address);
			// await execute('UniV3TwapOracle', {from: deployer, log: true}, 'toggleTokenForPricing');
			await execute('UniV3TwapOracle', {from: deployer, log: true}, 'setFallback', fallback.address);
			await execute('UniV2TwapOracle', {from: deployer, log: true}, 'update');
		}
	}
	//  else {
	// 	console.log('LP');
	// 	console.log(stakingAddress);
	// 	let oracle = await deploy('UniV2TwapOracle', {
	// 		from: deployer,
	// 		log: true,
	// 		proxy: {
	// 			proxyContract: 'OpenZeppelinTransparentProxy',
	// 			execute: {
	// 				methodName: 'initialize',
	// 				args: [stakingAddress, radiantToken.address, chainlinkEthUsd, config.TWAP_PERIOD, 30, true],
	// 			},
	// 		},
	// 	});
	// 	if (oracle.newlyDeployed) {
	// 		await execute('PriceProvider', {from: deployer, log: true}, 'setOracle', oracle.address);
	// 		await execute('PriceProvider', {from: deployer, log: true}, 'setUsePool', false);
	// 	}
	// }
};
export default func;
func.tags = ['oracle_v3'];
