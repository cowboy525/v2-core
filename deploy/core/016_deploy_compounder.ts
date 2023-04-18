import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getConfigForChain} from '../../config/index';
import {getWeth} from '../../scripts/getDepenencies';
import {getTxnOpts} from '../../scripts/deploy/helpers/getTxnOpts';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy, execute, read} = deployments;
	const {deployer, dao, treasury} = await getNamedAccounts();
	const {config, baseAssetWrapped} = getConfigForChain(await hre.getChainId());
	const txnOpts = await getTxnOpts(hre);

	const {weth} = await getWeth(hre);
	const wethAddr = weth.address;

	let routerAddr;
	if (network.tags.mocks) {
		const uniRouter = await deployments.get(`UniswapV2Router02`);
		routerAddr = uniRouter.address;
	} else {
		routerAddr = config.ROUTER_ADDR;
	}

	const lendingPoolAddressesProvider = await deployments.get(`LendingPoolAddressesProvider`);
	const multiFeeDistribution = await deployments.get(`MFD`);

	const lockzap = await deployments.get(`LockZap`);

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

	const compounder = await deploy('Compounder', {
		...txnOpts,
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

	if (compounder.newlyDeployed) {
		await execute('MFD', txnOpts, 'addRewardConverter', compounder.address);

		let {tickers} = await parseReserveTokens();
		let aTokens = tickers.map((ticker: any) => ticker.deposit);
		let underlying = tickers.map((ticker: any) => ticker.addr);

		await execute('Compounder', txnOpts, 'addRewardBaseTokens', aTokens);

		for (let i = 0; i < underlying.length; i++) {
			const u = underlying[i];
			await execute('Compounder', txnOpts, 'setRoutes', u, [u, wethAddr]);
		}
	}
};
export default func;
func.tags = ['accessories'];
