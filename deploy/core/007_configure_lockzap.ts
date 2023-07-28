import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'configure_lockzap',
	tags: ['core'],
	dependencies: ['deploy_lockzap'],
	runOnce: true,
});
let func = step.setFunction(async function () {
	const {execute} = step;

	const lockZap = await deployments.get('LockZap');
	await execute('PoolHelper', 'setLockZap', lockZap.address);
});
export default func;
