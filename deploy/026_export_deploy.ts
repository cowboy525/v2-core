
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getConfigForChain } from "../config/index";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  const { read } = deployments;
  const { config, baseAssetWrapped } = getConfigForChain(await hre.getChainId());

  let deps = await deployments.all();

  let stakingAddress = await read("UniswapPoolHelper", "lpTokenAddr");
  let lendingPool = await read("LendingPoolAddressesProvider", "getLendingPool");
  let wrappedBaseDebtToken;

  let allTokenAddrs: any[] = [];
  let allTokens: any = {};
  let tickers: any = [];
  const allReservesTokens = await read("AaveProtocolDataProvider", "getAllReservesTokens");

  for (let index = 0; index < allReservesTokens.length; index++) {
    const element = allReservesTokens[index];
    const [symbol, tokenAddress] = element;
    const [aTokenAddress, stableDebtTokenAddress, variableDebtTokenAddress] =
      await read("AaveProtocolDataProvider", "getReserveTokensAddresses", tokenAddress)
    allTokens[`r${symbol}`] = aTokenAddress;
    allTokens[`vd${symbol}`] = variableDebtTokenAddress;
    allTokenAddrs.push(aTokenAddress);
    allTokenAddrs.push(variableDebtTokenAddress);

    if (symbol == baseAssetWrapped) {
      wrappedBaseDebtToken = variableDebtTokenAddress
    }

    tickers.push({
      ticker: symbol,
      addr: tokenAddress,
      debt: variableDebtTokenAddress,
      deposit: aTokenAddress,
    });
  }

  let res = {
    "lendingPool": lendingPool,
    "lendingPoolAddressesProvider": deps["LendingPoolAddressesProvider"].address,
    "lendingPoolAddressesProviderRegistry": deps["LendingPoolAddressesProviderRegistry"].address,
    "wethGateway": deps["WETHGateway"].address,
    "rdntToken": deps["RadiantOFT"].address,
    "walletBalanceProvider": deps["WalletBalanceProvider"].address,
    "uiPoolDataProvider": deps["UiPoolDataProviderV2V3"].address,
    "aaveProtocolDataProvider": deps["AaveProtocolDataProvider"].address,
    "mfdStats": deps["MFDstats"].address,
    "middleFeeDistribution": deps["MiddleFeeDistribution"].address,
    "lpFeeDistribution": deps["LPMFD"].address,
    "multiFeeDistribution": deps["MFD"].address,
    "chefIncentivesController": deps["ChefIncentivesController"].address,
    "eligibilityDataProvider": deps["EligibilityDataProvider"].address,
    "stableAndVariableTokensHelper": deps["StableAndVariableTokensHelper"].address,
    "aTokensAndRatesHelper": deps["ATokensAndRatesHelper"].address,
    "aaveOracle": deps["AaveOracle"].address,
    "lendingRateOracle": deps["LendingRateOracle"].address,
    "leverager": deps["Leverager"].address,
    "stargateBorrow": deps["StargateBorrow"].address,
    "stargateRouter": config.STARGATE_ROUTER,
    "priceProvider": deps["PriceProvider"].address,
    "stakingToken": stakingAddress,
    "lockZap": deps["LockZap"].address,
    "lpLockerList": deps["LPLockerList"].address,
    "migration": deps["Migration"].address,
    "bountyManager": deps["BountyManager"].address,
    "poolHelper": deps["UniswapPoolHelper"].address,
    "radiantV1": deps["RDNTV1"].address,
    "uniV2TwapOracle": deps["UniV2TwapOracle"].address,
    "daoTreasury": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "baseAssetWrappedAddress": deps[baseAssetWrapped].address,
    "lendingPoolAddressProvider": deps["LendingPoolAddressesProvider"].address,
    wrappedBaseDebtToken,
    allTokenAddrs,
    allTokens
  }
  console.log(res);
  // fs.writeFileSync(`./deployments/${deployments.getNetworkName()}/deployData.json`, JSON.stringify(res, null, 4));
};
export default func;
func.tags = ['core'];
