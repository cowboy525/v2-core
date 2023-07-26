import {DeployStep} from '../../scripts/deploy/depfunc';
import {LP_PROVIDER} from '../../scripts/deploy/types';

let step = new DeployStep({
	id: 'deploy_lp',
	tags: ['core'],
	dependencies: ['weth'],
});
let func = step.setFunction(async function () {
	const {deploy, config, network, weth} = step;

	const radiantToken = await deployments.get('RadiantOFT');

	let useUniswapLpProvider = config.LP_PROVIDER === LP_PROVIDER.UNISWAP;
	let poolHelper;

	if (useUniswapLpProvider) {
		let router;
		if (network.tags.mocks) {
			router = (await deployments.get('UniswapV2Router02')).address;
		} else {
			router = config.ROUTER_ADDR;
		}

		const liquidityZap = await deploy('LiquidityZap', {
			proxy: {
				proxyContract: 'OpenZeppelinTransparentProxy',
				execute: {
					methodName: 'initialize',
					args: [],
				},
			},
		});

		let phContract = 'UniswapPoolHelper';
		if (network.tags.testing) {
			phContract = 'TestUniswapPoolHelper';
		}

		poolHelper = await deploy('PoolHelper', {
			contract: phContract,
			proxy: {
				proxyContract: 'OpenZeppelinTransparentProxy',
				execute: {
					methodName: 'initialize',
					args: [radiantToken.address, weth.address, router, liquidityZap.address],
				},
			},
		});
	} else {
		// Balancer
		poolHelper = await deploy('PoolHelper', {
			contract: 'BalancerPoolHelper',
			proxy: {
				proxyContract: 'OpenZeppelinTransparentProxy',
				execute: {
					init: {
						methodName: 'initialize',
						args: [
							weth.address,
							radiantToken.address,
							weth.address,
							config.BAL_VAULT,
							config.BAL_WEIGHTED_POOL_FACTORY,
						],
					},
				},
			},
		});
	}
});
export default func;
