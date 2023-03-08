
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getConfigForChain } from "../config/index";


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const { config } = getConfigForChain(await hre.getChainId());

  let aaveOracle = await deployments.get("AaveOracle");

  await deploy("MFDstats", {
    from: deployer,
    log: true,
    proxy: {
      proxyContract: 'OpenZeppelinTransparentProxy',
      execute: {
        methodName: 'initialize',
        args: [
          aaveOracle.address,
          config.EMISSIONS_RESERVE
        ]
      },
    }
  });
};
export default func;
func.tags = ['core'];
