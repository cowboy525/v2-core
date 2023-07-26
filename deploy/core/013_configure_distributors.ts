import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'configure_distributors',
	tags: ['core'],
	dependencies: ['deploy_distributors'],
	runOnce: true,
});
let func = step.setFunction(async function () {
	const {config, get, treasury, execute} = step;

	const mfd = await get('MFD');

	await execute('LockerList', 'transferOwnership', mfd.address);
	await execute('MiddleFeeDistribution', 'setOperationExpenses', treasury, config.OPEX_RATIO);
	await execute('LockZap', 'setMfd', mfd.address);
	await execute('MFD', 'setLockTypeInfo', config.LOCK_INFO.LOCK_PERIOD, config.LOCK_INFO.MULTIPLIER);
});
export default func;
