import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
const { ethers } = require("hardhat");
import { getConfigForChain } from "../config/index";
import { LendingPool } from "../typechain";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute, read } = deployments;
  const { deployer } = await getNamedAccounts();
  const { baseAssetWrapped } = getConfigForChain(await hre.getChainId());

  const formattedAmt = ethers.utils.parseUnits("100000", 18);
  let weth = await deployments.get(baseAssetWrapped);

  await execute(baseAssetWrapped, { from: deployer }, "mint", formattedAmt);

  const lendingPoolAddr = await read("LendingPoolAddressesProvider", "getLendingPool");
  const lendingPool = <LendingPool>await ethers.getContractAt("LendingPool", lendingPoolAddr);

  await execute(baseAssetWrapped, { from: deployer }, "approve", lendingPool.address, ethers.constants.MaxUint256);
  await (await lendingPool.deposit(weth.address, formattedAmt, deployer, 0)).wait();
};
export default func;
func.tags = ['core'];
