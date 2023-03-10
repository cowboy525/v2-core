import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getConfigForChain } from "../config/index";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute, read } = deployments;
  const { deployer, dao, treasury } = await getNamedAccounts();
  const { config, baseAssetWrapped } = getConfigForChain(await hre.getChainId());

  const radiantToken = await deployments.get("RadiantOFT");
  const baseAsset = await deployments.get(baseAssetWrapped);
  const router = await deployments.get("UniswapV2Router02");
  const priceProvider = await deployments.get(`PriceProvider`);
  const lockZap = await deployments.get(`LockZap`);
  const edp = await deployments.get(`EligibilityDataProvider`);
  const middleFeeDistribution = await deployments.get(`MiddleFeeDistribution`);
  const chefIncentivesController = await deployments.get(`ChefIncentivesController`);
  const lendingPoolAddressesProvider = await deployments.get(`LendingPoolAddressesProvider`);
  const aaveOracle = await deployments.get(`AaveOracle`);
  const lpFeeDistribution = await deployments.get(`LPMFD`);
  const multiFeeDistribution = await deployments.get(`MFD`);
  const autocompounder = await deployments.get("AutoCompounder");
  const lendingPool = await read("LendingPoolAddressesProvider", "getLendingPool");

  const parseReserveTokens = async () => {

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
      allTokenAddrs
    }
  }

  await deploy("Leverager", {
    from: deployer,
    log: true,
    args: [
      lendingPool,
      edp.address,
      aaveOracle.address,
      lockZap.address,
      baseAsset.address,
      config.FEE_LOOPING,
      treasury
    ]
  });

  await deploy("StargateBorrow", {
    from: deployer,
    log: true,
    args: [
      config.STARGATE_ROUTER,
      config.STARGATE_ROUTER_ETH,
      lendingPool,
      baseAsset.address,
      treasury,
      config.FEE_XCHAIN_BORROW
    ]
  });

  let bountyManager = await deploy("BountyManager", {
    from: deployer,
    log: true,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: [
          radiantToken.address,
          baseAsset.address,
          lpFeeDistribution.address,
          multiFeeDistribution.address,
          chefIncentivesController.address,
          priceProvider.address,
          edp.address,
          autocompounder.address,
          config.DQ_HUNTER_SHARE,
          config.DQ_TARGET_BASE_BOUNTY_USD,
          config.DQ_MAX_BASE_BOUNTY,
          config.DQ_BOOSTER
        ]
      },
    }
  });

  if (bountyManager.newlyDeployed) {

    await execute("MFD", { from: deployer }, "setBountyManager", bountyManager.address);
    await execute("LPMFD", { from: deployer }, "setBountyManager", bountyManager.address);
    await execute("ChefIncentivesController", { from: deployer }, "setBountyManager", bountyManager.address);
    await execute("AutoCompounder", { from: deployer }, "setBountyManager", bountyManager.address);

    await execute("RadiantOFT", { from: dao }, "transfer", bountyManager.address, config.SUPPLY_DQ_RESERVE);

    await execute("ChefIncentivesController", { from: deployer }, "setEligibilityExempt", multiFeeDistribution.address);
    await execute("ChefIncentivesController", { from: deployer }, "setEligibilityExempt", lpFeeDistribution.address);
    await execute("ChefIncentivesController", { from: deployer }, "setEligibilityExempt", middleFeeDistribution.address);
    await execute("ChefIncentivesController", { from: deployer }, "setEligibilityExempt", bountyManager.address);

    let { tickers, allTokens } = await parseReserveTokens();
    let aTokens = tickers.map((ticker) => ticker.deposit);
    let underlying = tickers.map((ticker) => ticker.addr);

    await execute("AutoCompounder", { from: deployer }, "addRewardBaseTokens", aTokens);

    for (let i = 0; i < underlying.length; i++) {
      const u = underlying[i];
      await execute("AutoCompounder", { from: deployer }, "setRoutes", u, [u, baseAsset.address]);
    }

    const assets = config.STARGATE_CONFIG.ASSETS;
    const poolIds = config.STARGATE_CONFIG.POOL_IDS;
    await execute("StargateBorrow", { from: deployer }, "setPoolIDs", assets, poolIds);
  }
};
export default func;
func.tags = ['core'];
