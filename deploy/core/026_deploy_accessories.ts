import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'deploy_accessories',
	tags: ['core'],
	dependencies: ['lending', 'distributors'],
});
let func = step.setFunction(async function () {
	const {deploy, get, read, config, weth, treasury} = step;

	const lockZap = await get(`LockZap`);
	const edp = await get(`EligibilityDataProvider`);
	const aaveOracle = await get(`AaveOracle`);
	const cic = await get(`ChefIncentivesController`);
	const lendingPool = await read('LendingPoolAddressesProvider', 'getLendingPool');

	await deploy('Multicall3');

	await deploy('Leverager', {
		args: [
			lendingPool,
			edp.address,
			aaveOracle.address,
			lockZap.address,
			cic.address,
			weth.address,
			config.FEE_LOOPING,
			treasury,
			config.LEVERAGER_ZAP_MARGIN,
		],
	});

	await deploy('StargateBorrow', {
		proxy: {
			proxyContract: 'OpenZeppelinTransparentProxy',
			execute: {
				init: {
					methodName: 'initialize',
					args: [
						config.STARGATE_ROUTER,
						config.STARGATE_ROUTER_ETH,
						lendingPool,
						weth.address,
						treasury,
						config.FEE_XCHAIN_BORROW,
						config.STARGATE_MAX_SLIPPAGE,
					],
				},
			},
		},
	});
});
export default func;
