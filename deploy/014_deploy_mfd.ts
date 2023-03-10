import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getConfigForChain } from "../config/index";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute } = deployments;
  const { deployer, treasury, dao } = await getNamedAccounts();
  const { config, baseAssetWrapped } = getConfigForChain(await hre.getChainId());

  let radiantToken = await deployments.get("RadiantOFT");
  let baseAsset = await deployments.get(baseAssetWrapped);
  let priceProvider = await deployments.get(`PriceProvider`);
  let lockZap = await deployments.get(`LockZap`);
  let mfdStats = await deployments.get(`MFDstats`);
  let lendingPoolAddressesProviderDep = await deployments.get(`LendingPoolAddressesProvider`);

  const lockerList = await deploy("MFDLockerList", {
    contract: "LockerList",
    from: deployer,
    log: true
  });

  const lpLockerList = await deploy("LPLockerList", {
    contract: "LockerList",
    from: deployer,
    log: true
  });

  const mfd = await deploy("MFD", {
    from: deployer,
    log: true,
    contract: "MultiFeeDistribution",
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: [
          radiantToken.address,
          lockZap.address,
          dao,
          lockerList.address,
          priceProvider.address,
          config.MFD_REWARD_DURATION_SECS,
          config.MFD_REWARD_LOOKBACK_SECS,
          config.MFD_LOCK_DURATION_SECS,
          config.MFD_BURN_RATIO,
          config.MFD_VEST_DURATION,
        ]
      },
    }
  });
  const lpMfd = await deploy("LPMFD", {
    from: deployer,
    log: true,
    contract: "MultiFeeDistribution",
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: [
          radiantToken.address,
          lockZap.address,
          dao,
          lpLockerList.address,
          priceProvider.address,
          config.MFD_REWARD_DURATION_SECS,
          config.MFD_REWARD_LOOKBACK_SECS,
          config.MFD_LOCK_DURATION_SECS,
          config.MFD_BURN_RATIO,
          config.MFD_VEST_DURATION,
        ]
      },
    }
  });
  const middleFee = await deploy("MiddleFeeDistribution", {
    from: deployer,
    log: true,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: [
          radiantToken.address,
          mfdStats.address,
          lpMfd.address,
          mfd.address
        ]
      },
    }
  });


  if (mfd.newlyDeployed) {
    await execute("MFDLockerList", { from: deployer, log: true }, "transferOwnership", mfd.address);
    await execute("LPLockerList", { from: deployer, log: true }, "transferOwnership", lpMfd.address);
    await execute("MiddleFeeDistribution", { from: deployer, log: true }, "setLpLockingRewardRatio", config.MFD_LP_RATIO);
    await execute("MFDstats", { from: deployer, log: true }, "setMiddleFee", middleFee.address);
    await execute("MiddleFeeDistribution", { from: deployer, log: true }, "setOperationExpenses", treasury, config.OPEX_RATIO);
    await execute("LockZap", { from: deployer, log: true }, "setLpMfd", lpMfd.address);
    await execute("LockZap", { from: deployer, log: true }, "setMfd", mfd.address);
    await execute("LPMFD", { from: deployer, log: true }, "setLockTypeInfo", config.LOCK_INFO.LOCK_PERIOD, config.LOCK_INFO.MULTIPLIER);
    await execute("MFD", { from: deployer, log: true }, "setLockTypeInfo", config.LOCK_INFO.LOCK_PERIOD, config.LOCK_INFO.MULTIPLIER);
  }

  let uniRouter = await deployments.get(`UniswapV2Router02`);
  let lockzap = await deployments.get(`LockZap`);
  const AutoCompounder = await deploy("AutoCompounder" , {
    from: deployer,
    log: true,
    args: [
      uniRouter.address,
      lpMfd.address,
      baseAsset.address,
      lendingPoolAddressesProviderDep.address,
      lockzap.address
    ]
  });

  await execute("LPMFD", {from: deployer, log: true}, "addRewardConverter", AutoCompounder.address);
};
export default func;
func.tags = ['core'];
