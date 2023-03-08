
import fs from "fs";
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
const { ethers } = require("hardhat");
import * as config from "../config/index";
import { getConfigForChain } from "../config/index";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute, read } = deployments;
  const { deployer } = await getNamedAccounts();
  const { config, baseAssetWrapped } = getConfigForChain(await hre.getChainId());

  const weth = await ethers.getContract(baseAssetWrapped);
  const mockAssets = JSON.parse(fs.readFileSync(`./config/mock-assets.json`).toString());
  const assets = mockAssets[config.CHAIN_ID];

  // TODO: make better for more chains
  let baseAssetPrice = config.CHAIN_ID == 97 ? 300 : 1600;

  for (let i = 0; i < assets.length; i += 1) {
    const [name, decimals, price] = assets[i];

    if (name !== baseAssetWrapped) {

      try {
        await deployments.get(name);
      } catch (e) {

        let mockTokenDep = await deploy(name, {
          contract: "MockToken",
          from: deployer,
          log: true,
          args: [
            name, name, decimals || 18
          ]
        });

        await deploy(`${name.toUpperCase()}Aggregator`, {
          contract: "MockChainlinkAggregator",
          from: deployer,
          log: true,
          args: [
            price
          ]
        });

        const uniswapV2Router02 = await deployments.get("UniswapV2Router02");

        let baseAmt = 100000;
        let baseValueUsd = baseAmt * baseAssetPrice;
        let assetPrice = price / (10 ** 8);
        let assetAmt = baseValueUsd / assetPrice;
        let ethAmt = ethers.utils.parseUnits(baseAmt.toString(), 18);

        await execute(name, { from: deployer, log: true }, 'mint', deployer, ethers.utils.parseUnits(assetAmt.toString(), decimals));
        await execute(baseAssetWrapped, { from: deployer, log: true }, 'mint', ethAmt);

        await execute(baseAssetWrapped, { from: deployer, log: true }, 'approve', uniswapV2Router02.address, ethers.constants.MaxUint256);
        await execute(name, { from: deployer, log: true }, 'approve', uniswapV2Router02.address, ethers.constants.MaxUint256);

        await execute('UniswapV2Router02', { from: deployer, log: true }, 'addLiquidity',
          mockTokenDep.address,
          weth.address,
          await read(name, "balanceOf", deployer),
          await weth.balanceOf(deployer),
          0,
          0,
          deployer,
          (await ethers.provider.getBlock("latest")).timestamp * 2
        )
      }
    } else {
      await deploy(`${name.toUpperCase()}Aggregator`, {
        contract: "MockChainlinkAggregator",
        from: deployer,
        log: true,
        args: [
          price
        ]
      });
    }
  }

  let rdntV1 = await deploy('RDNTV1', {
    from: deployer,
    contract: "MockToken",
    log: true,
    args: [
      "Radiant V1", "Radiant V1", 18
    ]
  });
  if (rdntV1.newlyDeployed) {
    await execute('RDNTV1', { from: deployer, log: true }, 'mint', deployer, ethers.utils.parseUnits("100000", 18));
  }
};
export default func;
func.tags = ['core'];
