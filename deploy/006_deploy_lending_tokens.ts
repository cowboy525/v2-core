
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getConfigForChain } from "../config/index";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, read } = deployments;
  const { deployer } = await getNamedAccounts();

  const lendingPool = await read("LendingPoolAddressesProvider", "getLendingPool");
  const lendingPoolConfigurator = await read("LendingPoolAddressesProvider", "getLendingPoolConfigurator");
  let lendingPoolAddressesProvider = await deployments.get("LendingPoolAddressesProvider");

  await deploy('StableAndVariableTokensHelper', {
    from: deployer,
    log: true,
    args: [
      lendingPool,
      lendingPoolAddressesProvider.address
    ]
  });

  await deploy('ATokensAndRatesHelper', {
    from: deployer,
    log: true,
    args: [
      lendingPool,
      lendingPoolAddressesProvider.address,
      lendingPoolConfigurator
    ]
  });

  await deploy('AToken', {
    from: deployer,
    log: true,
  });

  await deploy('StableDebtToken', {
    from: deployer,
    log: true,
  });

  await deploy('VariableDebtToken', {
    from: deployer,
    log: true,
  });
};
export default func;
func.tags = ['core'];
