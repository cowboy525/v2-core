import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
const { ethers } = require("hardhat");
import { getConfigForChain } from "../config/index";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { execute, read } = deployments;
  const { deployer } = await getNamedAccounts();

  const stakingAddress = await read("UniswapPoolHelper", "lpTokenAddr");
  const priceProvider = await deployments.get(`PriceProvider`);
  const rdnt = await deployments.get(`RadiantOFT`);
  const leverager = await deployments.get(`Leverager`);
  const currentStakingToken = await read("LPMFD", {}, "stakingToken");

  if (currentStakingToken == "0x0000000000000000000000000000000000000000") {
    await execute("LPMFD", { from: deployer }, "setLPToken", stakingAddress);
    await execute("MFD", { from: deployer }, "setLPToken", rdnt.address);
    await execute("EligibilityDataProvider", { from: deployer }, "setLPToken", stakingAddress);
    await execute("RadiantOFT", { from: deployer }, "setPriceProvider", priceProvider.address);

    const libraries = {
      "contracts/lending/libraries/logic/ValidationLogic.sol:ValidationLogic":
        (await deployments.get("ValidationLogic")).address,
      "contracts/lending/libraries/logic/ReserveLogic.sol:ReserveLogic":
        (await deployments.get("ReserveLogic")).address,
    };

    const lendingPool = await read("LendingPoolAddressesProvider", "getLendingPool");
    const LendingPoolImpl = await ethers.getContractFactory("LendingPool", {
      libraries,
    });
    const LendingPoolProxy = LendingPoolImpl.attach(lendingPool);
    await (await LendingPoolProxy.setLeverager(leverager.address)).wait();
  }
};
export default func;
func.tags = ['core'];
