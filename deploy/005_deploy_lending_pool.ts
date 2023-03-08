
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
const { ethers } = require("hardhat");

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer, treasury } = await getNamedAccounts();

  const lendingPoolAddressesProviderRegistryDep = await deploy("LendingPoolAddressesProviderRegistry", {
    from: deployer,
    log: true
  });

  const lendingPoolAddressesProviderDep = await deploy('LendingPoolAddressesProvider', {
    from: deployer,
    log: true,
    args: [
      "Radiant",
    ]
  });

  if (lendingPoolAddressesProviderDep.newlyDeployed) {
    const lendingPoolAddressesProviderRegistry = await ethers.getContractAt("LendingPoolAddressesProviderRegistry", lendingPoolAddressesProviderRegistryDep.address)
    const lendingPoolAddressesProvider = await ethers.getContractAt("LendingPoolAddressesProvider", lendingPoolAddressesProviderDep.address)

    // Set the provider at the Registry
    await (
      await lendingPoolAddressesProviderRegistry.registerAddressesProvider(
        lendingPoolAddressesProvider.address,
        "1"
      )
    ).wait();

    // Set pool admins
    await (
      await lendingPoolAddressesProvider.setPoolAdmin(deployer)
    ).wait();
    await (
      await lendingPoolAddressesProvider.setEmergencyAdmin(deployer)
    ).wait();

    await (
      await lendingPoolAddressesProvider.setLiquidationFeeTo(treasury)
    ).wait();

    // Deploy libraries used by lending pool implementation, ReserveLogic
    const reserveLogic = await deploy('ReserveLogic', {
      from: deployer,
      log: true,
    });

    // Deploy libraries used by lending pool implementation, GenericLogic
    const genericLogic = await deploy('GenericLogic', {
      from: deployer,
      log: true,
    });

    // Deploy libraries used by lending pool implementation, ValidationLogic
    const validationLogic = await deploy('ValidationLogic', {
      from: deployer,
      log: true,
      libraries: {
        GenericLogic: genericLogic.address,
      },
    });

    const libraries = {
      "contracts/lending/libraries/logic/ValidationLogic.sol:ValidationLogic":
        validationLogic.address,
      "contracts/lending/libraries/logic/ReserveLogic.sol:ReserveLogic":
        reserveLogic.address,
    };

    const LendingPoolImpl = await ethers.getContractFactory("LendingPool", {
      libraries,
    });
    const lendingPoolImpl = await LendingPoolImpl.deploy();
    await lendingPoolImpl.deployed();
    await (
      await lendingPoolImpl.initialize(lendingPoolAddressesProvider.address)
    ).wait();

    await (
      await lendingPoolAddressesProvider.setLendingPoolImpl(
        lendingPoolImpl.address
      )
    ).wait();

    // LendingPool (InitializableImmutableAdminUpgradeabilityProxy)
    const lendingPoolProxy: any = LendingPoolImpl.attach(
      await lendingPoolAddressesProvider.getLendingPool()
    );

    const LendingPoolConfiguratorImpl = await ethers.getContractFactory(
      "LendingPoolConfigurator"
    );
    const lendingPoolConfiguratorImpl =
      await LendingPoolConfiguratorImpl.deploy();
    await lendingPoolConfiguratorImpl.deployed();

    await (
      await lendingPoolAddressesProvider.setLendingPoolConfiguratorImpl(
        lendingPoolConfiguratorImpl.address
      )
    ).wait();

    // LendingPoolConfigurator (InitializableImmutableAdminUpgradeabilityProxy)
    const lendingPoolConfiguratorProxy = LendingPoolConfiguratorImpl.attach(
      await lendingPoolAddressesProvider.getLendingPoolConfigurator()
    );
    await (await lendingPoolConfiguratorProxy.setPoolPause(true)).wait();
  }
};
export default func;
func.tags = ['core'];
