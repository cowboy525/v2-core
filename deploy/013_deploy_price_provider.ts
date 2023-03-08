
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getConfigForChain } from "../config/index";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();
  const { baseAssetWrapped } = getConfigForChain(await hre.getChainId());

  let poolHelper = await deployments.get("UniswapPoolHelper");
  let agg = await deployments.get(`${baseAssetWrapped}Aggregator`);
  let uniV2TwapOracle = await deployments.get(`UniV2TwapOracle`);

  const pp = await deploy("PriceProvider", {
    from: deployer,
    log: true,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: [
          agg.address,
          poolHelper.address,
          uniV2TwapOracle.address
        ]
      },
    }
  });

  if (pp.newlyDeployed) {
    await execute("RadiantOFT", { from: deployer }, "setPriceProvider", pp.address);
  }
};
export default func;
func.tags = ['core'];
