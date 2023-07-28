import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'deploy_aave_providers',
	tags: ['core'],
	dependencies: ['lending', 'distributors', 'cic'],
});
let func = step.setFunction(async function () {
	const {deploy, get, chainlinkEthUsd} = step;

	const chefIncentivesController = await get('ChefIncentivesController');
	const aaveOracle = await get('AaveOracle');

	await deploy('WalletBalanceProvider');

	await deploy('UiPoolDataProvider', {
		args: [chefIncentivesController.address, aaveOracle.address],
	});

	await deploy('UiPoolDataProviderV2V3', {
		args: [chainlinkEthUsd, chainlinkEthUsd],
	});
});
export default func;
