import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
const { AdminClient } = require('defender-admin-client');

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, network } = hre;

  // TODO: handle this better w/ test. this should not run during local/test
  if (!network.live) return;

  const client = new AdminClient({ apiKey: process.env.DEFENDER_API_KEY, apiSecret: process.env.DEFENDER_API_SECRET });
  const { get } = deployments;

  const rdnt = await deployments.getExtendedArtifact('RadiantOFT');

  const chainId = await hre.getChainId();

  const networks = {
    "97": "bsctest",
    "421613": "arbitrum-goerli"
  }
  const chain = networks[chainId];
  console.log(`network: ${chain}`);

  const contract = {
    network: chain,
    address: (await get("RadiantOFT")).address,
    name: "RadiantOFT",
    abi: JSON.stringify(rdnt.abi),
  };

  let contracts = await client.listContracts();
  for (const c of contracts) {
    console.log(c);
    if (c.name == contract.name && c.network == network) {
      await client.deleteContract(c.contractId);
    }
  }

  await client.addContract(contract);
};
func.tags = ['live', 'rdnt'];
export default func;
