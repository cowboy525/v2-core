import fs from 'fs';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getConfigForChain} from '../../config/index';
import {getWeth} from '../../scripts/getDepenencies';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, network} = hre;
	const {read} = deployments;
	const {deployer, dao, treasury} = await getNamedAccounts();
	const {config, baseAssetWrapped} = getConfigForChain(await hre.getChainId());

	let deps = await deployments.all();

	const {weth} = await getWeth(hre);
	const wethAddr = weth.address;

	let stakingAddress = await read('PoolHelper', 'lpTokenAddr');
	let lendingPool = await read('LendingPoolAddressesProvider', 'getLendingPool');
	let wrappedBaseDebtToken;

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

		if (symbol == baseAssetWrapped) {
			wrappedBaseDebtToken = variableDebtTokenAddress;
		}

		tickers.push({
			ticker: symbol,
			addr: tokenAddress,
			debt: variableDebtTokenAddress,
			deposit: aTokenAddress,
		});
	}

	const allTokenAddrsPromises = config.TOKENS_CONFIG.map(async (token) => {
		let tokenAddress;
		let key = token[0];

		if (network.tags.mocks) {
			tokenAddress = (await deployments.get(key)).address;
		} else {
			tokenAddress = token[1].assetAddress;
		}

		allTokens[key] = tokenAddress;
		return tokenAddress;
	});

	const mockTokenAddrs = await Promise.all(allTokenAddrsPromises);
	mockTokenAddrs.forEach((addr) => allTokenAddrs.push(addr));

	let v1;
	if (!!config.RADIANT_V1 && config.RADIANT_V1 === '0x0000000000000000000000000000000000000000') {
		v1 = deps['RDNTV1'].address;
	} else {
		v1 = config.RADIANT_V1;
	}

	let res: any = {
		lendingPool: lendingPool,
		lendingPoolAddressesProvider: deps['LendingPoolAddressesProvider'].address,
		lendingPoolAddressesProviderRegistry: deps['LendingPoolAddressesProviderRegistry'].address,
		wethGateway: deps['WETHGateway'].address,
		rdntToken: deps['RadiantOFT'].address,
		walletBalanceProvider: deps['WalletBalanceProvider'].address,
		uiPoolDataProvider: deps['UiPoolDataProviderV2V3'].address,
		aaveProtocolDataProvider: deps['AaveProtocolDataProvider'].address,
		middleFeeDistribution: deps['MiddleFeeDistribution'].address,
		multiFeeDistribution: deps['MFD'].address,
		chefIncentivesController: deps['ChefIncentivesController'].address,
		eligibilityDataProvider: deps['EligibilityDataProvider'].address,
		stableAndVariableTokensHelper: deps['StableAndVariableTokensHelper'].address,
		aTokensAndRatesHelper: deps['ATokensAndRatesHelper'].address,
		aaveOracle: deps['AaveOracle'].address,
		lendingRateOracle: deps['LendingRateOracle'].address,
		// multicall: deps['Multicall'].address,
		leverager: deps['Leverager'].address,
		stargateBorrow: deps['StargateBorrow'].address,
		stargateRouter: config.STARGATE_ROUTER,
		priceProvider: deps['PriceProvider'].address,
		stakingToken: stakingAddress,
		lockZap: deps['LockZap'].address,
		lpLockerList: deps['LockerList'].address,

		bountyManager: deps['BountyManager'].address,
		poolHelper: deps['PoolHelper'].address,
		daoTreasury: dao,
		baseAssetWrappedAddress: wethAddr,
		lendingPoolAddressProvider: deps['LendingPoolAddressesProvider'].address,
		compounder: deps['Compounder'].address,
		wrappedBaseDebtToken,
		allTokenAddrs,
		allTokens,
	};

	if (network.tags.oracle_v2) {
		res.uniV2TwapOracle = deps['UniV2TwapOracle'].address;
	}

	if (!!config.RADIANT_V1) {
		res.radiantV1 = v1;
		res.migration = deps['Migration'].address;
	}

	if (process.env.IS_CI === undefined || process.env.IS_CI !== 'true') {
		const path = `./deployments/${deployments.getNetworkName()}`;
		console.log(`=== Writing Frontend Config to: ${path} ===`);
		if (!fs.existsSync(path)) {
			fs.mkdirSync(path);
		}
		console.log(`^^ (if on localhost, replace "hardhat" with "localhost")`);
		fs.writeFileSync(`${path}/.deployData.json`, JSON.stringify(res, null, 4));
	}
};
export default func;
func.runAtTheEnd = true;
func.tags = ['export'];
