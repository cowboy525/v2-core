import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'configure_cic',
	tags: ['core', 'cic'],
	dependencies: ['deploy_cic'],
	runOnce: true,
});
let func = step.setFunction(async function () {
	const {config, execute, get} = step;

	const cic = await get('ChefIncentivesController');

	await execute('ChefIncentivesController', 'start');
	await execute('RadiantOFT', 'transfer', cic.address, config.SUPPLY_CIC_RESERVE);
	await execute('ChefIncentivesController', 'registerRewardDeposit', config.SUPPLY_CIC_RESERVE);
	await execute('EligibilityDataProvider', 'setChefIncentivesController', cic.address);
	await execute(`ChefIncentivesController`, 'setEndingTimeUpdateCadence', 86400);
});
export default func;
