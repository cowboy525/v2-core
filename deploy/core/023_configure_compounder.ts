import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'configure_compounder',
	tags: ['core'],
	dependencies: ['lending', 'distributors'],
	runOnce: true,
});
let func = step.setFunction(async function () {
	const {get, read, config, weth, execute} = step;

	const compounder = await get(`Compounder`);

	let routerAddr;
	if (network.tags.mocks) {
		const uniRouter = await deployments.get(`UniswapV2Router02`);
		routerAddr = uniRouter.address;
	} else {
		routerAddr = config.ROUTER_ADDR;
	}

	const parseReserveTokens = async () => {
		let allTokenAddrs: any[] = [];
		let allTokens: any = {};
		let tickers: any = [];

		const allReservesTokens = await read('AaveProtocolDataProvider', 'getAllReservesTokens');

		for (let index = 0; index < allReservesTokens.length; index++) {
			const element = allReservesTokens[index];
			const [symbol, tokenAddress] = element;
			const [aTokenAddress, stableDebtTokenAddress, variableDebtTokenAddress] = await read(
				'AaveProtocolDataProvider',
				'getReserveTokensAddresses',
				tokenAddress
			);
			allTokens[`r${symbol}`] = aTokenAddress;
			allTokens[`vd${symbol}`] = variableDebtTokenAddress;
			allTokenAddrs.push(aTokenAddress);
			allTokenAddrs.push(variableDebtTokenAddress);

			tickers.push({
				ticker: symbol,
				addr: tokenAddress,
				debt: variableDebtTokenAddress,
				deposit: aTokenAddress,
			});
		}
		return {
			tickers,
			allTokens,
			allTokenAddrs,
		};
	};

	await execute('MFD', 'addRewardConverter', compounder.address);

	let {tickers} = await parseReserveTokens();
	let aTokens = tickers.map((ticker: any) => ticker.deposit);
	let underlying = tickers.map((ticker: any) => ticker.addr);

	await execute('Compounder', 'addRewardBaseTokens', aTokens);

	for (let i = 0; i < underlying.length; i++) {
		const u = underlying[i];
		await execute('Compounder', 'setRoutes', u, [u, weth.address]);
	}
});
export default func;
