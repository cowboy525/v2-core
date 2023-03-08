import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getConfigForChain } from "../config/index";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute, read } = deployments;
  const { deployer, dao } = await getNamedAccounts();
  const { config } = getConfigForChain(await hre.getChainId());

  const radiantToken = await deployments.get("RadiantOFT");
  const rdntV1 = await deployments.get(`RDNTV1`);

  const migration = await deploy("Migration", {
    from: deployer,
    log: true,
    args: [
      rdntV1.address,
      radiantToken.address
    ]
  });

  if (migration.newlyDeployed) {
    await execute("RadiantOFT", { from: dao, log: true }, "transfer", migration.address, config.SUPPLY_MIGRATION_MINT);
  }
};
export default func;
func.tags = ['core'];
