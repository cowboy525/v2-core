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

    let config = getConfigForChain(await hre.getChainId());
    let chainId = await hre.getChainId();

    const chainIds = [421613, 97];

    const directories = {
        97: 'bsc-testnet',
        421613: 'arbitrum-goerli',
        // 31337: 'localhost'
    }

    const lzChainId: { [key: number | string]: number } = {
        97: 10102, // bsc testnet
        421613: 10143, // arbi testnet
        // 31337: 10143, // bsc testnet
    }
    const ofts: { [key: number]: string } = {}
    for (let i = 0; i < chainIds.length; i += 1) {
        const config = JSON.parse(fs.readFileSync(`./deployments/${directories[chainIds[i]]}/RadiantOFT.json`).toString());
        console.log('got config');
        console.log(config.address);
        ofts[chainIds[i]] = config.address;
    }

    const rdnt = await ethers.getContractAt("RadiantOFT", ofts[chainId]);
    console.log(`rdnt: ${rdnt.address}`);

    for (const [curChain, oftAddress] of Object.entries(ofts)) {
        if (curChain != chainId.toString()) {
            let trustedRemote = ethers.utils.solidityPack(
                ['address', 'address'],
                [oftAddress, rdnt.address]
            )

            console.log(`setTrustedRemote from ${chainId} to ${curChain} with ${lzChainId[curChain]} and ${oftAddress}`);
            const txn = await rdnt.setTrustedRemote(
                lzChainId[curChain],
                // oftAddress
                trustedRemote
            );
            console.log(txn.hash);
        }
    }
})();