import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'deploy_price_provider',
	tags: ['core'],
	dependencies: ['configure_lp', 'lending', 'token'],
});
let func = step.setFunction(async function () {
	const {deploy, chainlinkEthUsd, get} = step;

	const poolHelper = await get('PoolHelper');

	await deploy('PriceProvider', {
		proxy: {
			proxyContract: 'OpenZeppelinTransparentProxy',
			execute: {
				init: {
					methodName: 'initialize',
					args: [chainlinkEthUsd, poolHelper.address],
				},
			},
		},
	});
});
export default func;
