import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'configure_price_provider',
	tags: ['core'],
	dependencies: ['deploy_price_provider'],
	runOnce: true,
});
let func = step.setFunction(async function () {
	const {get, execute} = step;

	const priceProvider = await get('PriceProvider');

	await execute('RadiantOFT', 'setPriceProvider', priceProvider.address);
	await execute('LockZap', 'setPriceProvider', priceProvider.address);
	await execute('LiquidityZap', 'setPriceProvider', priceProvider.address);
});
export default func;
