
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getConfigForChain } from "../config/index";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute, read } = deployments;
  const { deployer } = await getNamedAccounts();
  const { baseAssetWrapped } = getConfigForChain(await hre.getChainId());

  const WETH = await deployments.get(baseAssetWrapped);
  const lendingPool = await read("LendingPoolAddressesProvider", "getLendingPool");

  await deploy('WETHGateway', {
    from: deployer,
    log: true,
    args: [
      WETH.address
    ]
  });

  await execute("WETHGateway", { from: deployer, log: true }, "authorizeLendingPool", lendingPool);
};
export default func;
func.tags = ['core'];
