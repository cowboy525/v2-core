import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'configure_edp',
	tags: ['core'],
	dependencies: ['deploy_edp'],
	runOnce: true,
});
let func = step.setFunction(async function () {
	const {config, execute} = step;

	await execute('EligibilityDataProvider', 'setRequiredDepositRatio', config.P2P_RATIO);
});
export default func;
