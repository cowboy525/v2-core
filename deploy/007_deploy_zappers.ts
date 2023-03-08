
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getConfigForChain } from "../config/index";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute, read } = deployments;
  const { deployer, dao } = await getNamedAccounts();
  const { config, baseAssetWrapped } = getConfigForChain(await hre.getChainId());

  const WETH = await deployments.get(baseAssetWrapped);
  const radiantToken = await deployments.get("RadiantOFT");
  const router = await deployments.get("UniswapV2Router02");
  const lendingPool = await read("LendingPoolAddressesProvider", "getLendingPool");

  if (true) { //this.config.LP_PROVIDER === LP_PROVIDER.UNISWAP

    const liquidityZap = await deploy("LiquidityZap", {
      from: deployer,
      log: true,
      proxy: {
        proxyContract: 'OpenZeppelinTransparentProxy',
        execute: {
          methodName: 'initialize',
          args: [],
        },
      }
    });

    let poolHelper = await deploy("UniswapPoolHelper", {
      from: deployer,
      log: true,
      contract: "TestUniswapPoolHelper",
      proxy: {
        proxyContract: 'OpenZeppelinTransparentProxy',
        execute: {
          methodName: 'initialize',
          args: [
            radiantToken.address,
            WETH.address,
            router.address,
            liquidityZap.address
          ]
        },
      }
    });

    if (poolHelper.newlyDeployed) {
      await execute(baseAssetWrapped, { from: deployer, log: true }, "mint", config.LP_INIT_ETH);
      await execute(baseAssetWrapped, { from: deployer, log: true }, "transfer", poolHelper.address, config.LP_INIT_ETH);
      await execute("RadiantOFT", { from: dao, log: true }, "transfer", poolHelper.address, config.LP_INIT_RDNT);
      await execute("UniswapPoolHelper", { from: deployer, log: true }, "initializePool");
    }

    await deploy("LockZap", {
      from: deployer,
      log: true,
      // TODO: use real when not testnet
      contract: "TestnetLockZap",
      proxy: {
        proxyContract: 'OpenZeppelinTransparentProxy',
        execute: {
          methodName: 'initialize',
          args: [
            poolHelper.address,
            lendingPool,
            WETH.address,
            radiantToken.address
          ]
        },
      }
    });
  }
};
export default func;
func.tags = ['core'];
