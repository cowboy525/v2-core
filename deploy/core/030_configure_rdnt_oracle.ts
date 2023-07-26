import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'configure_oracle',
	tags: ['core'],
	dependencies: ['deploy_rdnt_oracle'],
	runOnce: true,
});
let func = step.setFunction(async function () {
	const {get, execute} = step;

	let oracle;
	if (network.tags.oracle_v3) {
		oracle = await get('UniV3TwapOracle');
	} else if (network.tags.oracle_v2) {
		oracle = await get('UniV2TwapOracle');
	} else {
		oracle = await get('ChainlinkV3Adapter');
	}

	await execute('PriceProvider', 'setUsePool', false);
	await execute('PriceProvider', 'setOracle', oracle.address);

	if (network.tags.oracle_v2) {
		await execute('UniV2TwapOracle', 'update');
	}
});
export default func;
