import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getConfigForChain } from "../config/index";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { execute, read } = deployments;
  const { deployer } = await getNamedAccounts();
  const { config } = getConfigForChain(await hre.getChainId());

  const cic = await deployments.get(`ChefIncentivesController`);
  const middleFeeDistribution = await deployments.get(`MiddleFeeDistribution`);
  const mintersSet = await read("LPMFD", "mintersAreSet");

  if (!mintersSet) {
    await execute("LPMFD", { from: deployer, log: true }, "setMinters", [
      middleFeeDistribution.address,
      cic.address,
    ]);

    await execute("LPMFD", { from: deployer, log: true }, "setAddresses",
      cic.address,
      middleFeeDistribution.address,
      config.STARFLEET_TREASURY
    );

    await execute("MFD", { from: deployer, log: true }, "setMinters", [
      middleFeeDistribution.address,
      cic.address,
    ]);

    await execute("MFD", { from: deployer, log: true }, "setAddresses",
      cic.address,
      middleFeeDistribution.address,
      config.STARFLEET_TREASURY
    );
  }
};
export default func;
func.tags = ['core'];
