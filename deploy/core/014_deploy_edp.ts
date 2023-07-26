import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'deploy_edp',
	tags: ['core'],
	dependencies: ['lending', 'distributors'],
});
let func = step.setFunction(async function () {
	const {deploy, get} = step;

	const priceProvider = await get('PriceProvider');
	const lendingPool = await get('LendingPool');
	const middleFeeDistribution = await get('MiddleFeeDistribution');

	await deploy('EligibilityDataProvider', {
		proxy: {
			proxyContract: 'OpenZeppelinTransparentProxy',
			execute: {
				init: {
					methodName: 'initialize',
					args: [lendingPool.address, middleFeeDistribution.address, priceProvider.address],
				},
			},
		},
	});
});
export default func;
