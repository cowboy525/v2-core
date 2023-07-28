import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'deploy_compounder',
	tags: ['core'],
	dependencies: ['lending', 'distributors'],
});
let func = step.setFunction(async function () {
	const {deploy, get, read, config, weth} = step;

	const lendingPoolAddressesProvider = await get(`LendingPoolAddressesProvider`);
	const multiFeeDistribution = await get(`MFD`);
	const lockzap = await get(`LockZap`);

	let routerAddr;
	if (network.tags.mocks) {
		const uniRouter = await deployments.get(`UniswapV2Router02`);
		routerAddr = uniRouter.address;
	} else {
		routerAddr = config.ROUTER_ADDR;
	}

	await deploy('Compounder', {
		proxy: {
			proxyContract: 'OpenZeppelinTransparentProxy',
			execute: {
				init: {
					methodName: 'initialize',
					args: [
						routerAddr,
						multiFeeDistribution.address,
						weth.address,
						lendingPoolAddressesProvider.address,
						lockzap.address,
						config.AC_FEE * 100,
						config.AC_SLIPPAGE_LIMIT,
					],
				},
			},
		},
	});
});
export default func;
