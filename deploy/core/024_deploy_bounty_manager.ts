import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'deploy_compounder',
	tags: ['core'],
	dependencies: ['lending', 'distributors'],
});
let func = step.setFunction(async function () {
	const {deploy, get, config, weth} = step;

	const edp = await get('EligibilityDataProvider');
	const chefIncentivesController = await get('ChefIncentivesController');
	const radiantToken = await get('RadiantOFT');
	const priceProvider = await get(`PriceProvider`);
	const compounder = await deployments.get(`Compounder`);
	const multiFeeDistribution = await deployments.get(`MFD`);

	await deploy('BountyManager', {
		proxy: {
			proxyContract: 'OpenZeppelinTransparentProxy',
			execute: {
				init: {
					methodName: 'initialize',
					args: [
						radiantToken.address,
						weth.address,
						multiFeeDistribution.address,
						chefIncentivesController.address,
						priceProvider.address,
						edp.address,
						compounder.address,
						config.DQ_HUNTER_SHARE,
						config.DQ_TARGET_BASE_BOUNTY_USD,
						config.DQ_MAX_BASE_BOUNTY,
					],
				},
			},
		},
	});
});
export default func;
