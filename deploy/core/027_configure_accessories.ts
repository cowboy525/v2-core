import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'configure_accessories',
	tags: ['core'],
	dependencies: ['lending', 'distributors'],
	runOnce: true,
});
let func = step.setFunction(async function () {
	const {get, execute, read, config} = step;

	const leverager = await get(`Leverager`);

	await execute('ChefIncentivesController', 'setLeverager', leverager.address);

	const assets = config.STARGATE_CONFIG.ASSETS;
	const poolIds = config.STARGATE_CONFIG.POOL_IDS;
	await execute('StargateBorrow', 'setPoolIDs', assets, poolIds);
});
export default func;
