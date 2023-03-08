import * as dotenv from "dotenv";

import { ethers } from "hardhat";

dotenv.config();

async function main() {
  await ethers.provider.send("evm_setIntervalMining", [1000]);
  console.log(`Set interval mining`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
