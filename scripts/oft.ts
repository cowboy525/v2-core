import { ethers } from "hardhat";
import { getConfigForChain } from "../config";
import HardhatDeployConfig from "../config/31337";
import { LendingPool } from "../typechain";
import fs from "fs";

const hre = require('hardhat');
const { deployments, getNamedAccounts } = hre;

(async () => {
    let deps = await deployments.all();
    console.log();

    const { read, execute } = deployments;
    const { deployer } = await getNamedAccounts();

    const rdnt = await ethers.getContractAt("RadiantOFT", (await deployments.get("RadiantOFT")).address);
    console.log(rdnt.address);

    let amt = ethers.utils.parseEther("100");
    console.log(amt);

    // await rdnt.burn(amt);
    // console.log(`burned`);

    let dest = "10102"; //bsc
    // let dest = "10143"; //arbi

    let toAddressBytes32 = ethers.utils.defaultAbiCoder.encode(['address'], [deployer])

    let res1 = await rdnt.estimateSendFee(dest, toAddressBytes32, amt, false, "0x");
    console.log(res1);

    let res = await rdnt.bridge(amt, dest, {
        value: res1.nativeFee
    });
    console.log(res);

})();