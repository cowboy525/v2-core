import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { execute, read } = deployments;
  const { deployer, dao } = await getNamedAccounts();

  // TODO: handle this better w/ test. this should not run during local/test
  // if (!network.live) return;

  let rdntBalance = await read("RadiantOFT", { from: deployer }, "balanceOf", deployer);
  await execute("RadiantOFT", { from: deployer, log: true }, "transfer", dao, rdntBalance);
};
export default func;
func.tags = ['live'];
