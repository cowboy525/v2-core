import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getConfigForChain } from "../config/index";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, read } = deployments;
  const { deployer } = await getNamedAccounts();
  const { config, baseAssetWrapped } = getConfigForChain(await hre.getChainId());

  let stakingAddress = await read("UniswapPoolHelper", "lpTokenAddr");
  let radiantToken = await deployments.get("RadiantOFT");
  let agg = await deployments.get(`${baseAssetWrapped}Aggregator`);

  await deploy("UniV2TwapOracle", {
    from: deployer,
    log: true,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: [
          stakingAddress,
          radiantToken.address,
          agg.address,
          config.TWAP_PERIOD,
          120,
          true
        ]
      },
    }
  });
};
export default func;
func.tags = ['core'];
