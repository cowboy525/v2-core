import {DeployStep} from '../../scripts/deploy/depfunc';
import {LP_PROVIDER} from '../../scripts/deploy/types';

let step = new DeployStep({
	id: 'deploy_lockzap',
	tags: ['core'],
	dependencies: ['configure_lp', 'lending'],
});
let func = step.setFunction(async function () {
	const {deploy, read, config, get, weth} = step;

	const poolHelper = await get('PoolHelper');
	const lendingPool = await read('LendingPoolAddressesProvider', 'getLendingPool');
	const radiantToken = await get('RadiantOFT');

	let useUniswapLpProvider = config.LP_PROVIDER === LP_PROVIDER.UNISWAP;
	const ethLpRatio = useUniswapLpProvider ? 5000 : 2000;

	let lockzapContract = 'LockZap';
	if (hre.network.tags.mocks) {
		lockzapContract = 'TestnetLockZap';
	}

	await deploy('LockZap', {
		contract: lockzapContract,
		proxy: {
			proxyContract: 'OpenZeppelinTransparentProxy',
			execute: {
				init: {
					methodName: 'initialize',
					args: [poolHelper.address, lendingPool, weth.address, radiantToken.address, ethLpRatio],
				},
			},
		},
	});
});
export default func;
