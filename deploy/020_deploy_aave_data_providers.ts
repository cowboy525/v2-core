import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getConfigForChain } from "../config/index";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { baseAssetWrapped } = getConfigForChain(await hre.getChainId());

  const agg = await deployments.get(`${baseAssetWrapped}Aggregator`);
  const chefIncentivesController = await deployments.get(`ChefIncentivesController`);
  const aaveOracle = await deployments.get(`AaveOracle`);

  await deploy("WalletBalanceProvider", {
    from: deployer,
    log: true
  });

  await deploy("UiPoolDataProvider", {
    from: deployer,
    log: true,
    args: [
      chefIncentivesController.address,
      aaveOracle.address
    ]
  });

  await deploy("UiPoolDataProviderV2V3", {
    from: deployer,
    log: true,
    args: [
      agg.address,
      agg.address
    ]
  });
};
export default func;
func.tags = ['core'];
