import { ethers, upgrades } from "hardhat";
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
import _ from "lodash";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { deployAndSetup, advanceTimeAndBlock } from "../shared/helpers";
import { MockChainlinkAggregator, RadiantOFT, TestnetLockZap, UniSwapV3Oracle, WETH } from "../../typechain-types";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
const SwapRouterABI = require('./interfaces/ISwapRouter.json')
const { deployments } = require('hardhat');

chai.use(solidity);
const { expect } = chai;

const priceToJsNum = (oracleAnswer: BigNumber) => {
  return parseFloat(ethers.utils.formatUnits(oracleAnswer, 8))
}

/*
 *
 * This test uses a UniV3 pool deployed on Arbi 
 * ensure hardhat fork config is forking Arbi 
 *
*/
describe("Uni V3 TWAP", () => {

  let oracle: UniSwapV3Oracle;
  let owner: SignerWithAddress;
  let router: Contract;
  let price0;

  const twapPeriod = 1200;

  before(async () => {

    const { deploy, execute } = deployments;
    owner = (await ethers.getSigners())[0]

    // const UniV3TwapOracle = await ethers.getContractFactory("UniV3TwapOracle");

    const magicPair = "0x7e7fb3cceca5f2ac952edf221fd2a9f62e411980";
    const magicAddr = "0x539bde0d7dbd336b79148aa742883198bbf60342";
    const ethFeed = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612";

    await deploy("UniV3TwapOracle", {
      from: owner.address,
      log: true,
      proxy: {
        proxyContract: 'OpenZeppelinTransparentProxy',
        execute: {
          methodName: 'initialize',
          args: [
            magicPair,
            magicAddr,
            ethFeed,
            twapPeriod
          ]
        },
      }
    });

    router = new ethers.Contract('0xE592427A0AEce92De3Edee1F18E0157C05861564', SwapRouterABI, ethers.provider);
    oracle = await ethers.getContract("UniV3TwapOracle");
  })

  it("returns price", async () => {

    await advanceTimeAndBlock(twapPeriod);

    price0 = await oracle.latestAnswer();
    console.log("priceAnswer: ", price0.toString())
    expect(
      Number(ethers.utils.formatUnits(price0, 8))
    ).not.equals(0);
  });


  xit("LP token change reflected in price after update", async () => {
    const price1 = await oracle.latestAnswer();

    for (let i = 0; i < 2; i++) {

      const depositAmt = ethers.utils.parseEther("3000");

      const swapParams = {
        tokenIn: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        tokenOut: '0x539bdE0d7Dbd336b79148AA742883198BBF60342',
        fee: 500,
        recipient: owner.address,
        deadline: Math.floor(Date.now() / 1000) + 60 * 10000,
        amountIn: depositAmt,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      };
      const wethContract = new ethers.Contract('0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', ["function approve(address, uint256)", "function balanceOf(address account) external view returns (uint256)", "function deposit() external payable"], ethers.provider);
      await wethContract.connect(owner).approve('0xE592427A0AEce92De3Edee1F18E0157C05861564', '2916829480085935000000000000000000000000000000000000000', { gasLimit: 5000000 });
      await wethContract.connect(owner).deposit({ value: depositAmt });
      const balanceWETH = await wethContract.balanceOf(owner.address);
      console.log("balanceWETH before buy MAGIC: ", balanceWETH);
      const swapGasPrice = await ethers.provider.getFeeData();

      try {
        const tx = await router
          .connect(owner)
          .exactInputSingle(swapParams, {
            maxFeePerGas: swapGasPrice.maxFeePerGas,
            maxPriorityFeePerGas: swapGasPrice.maxPriorityFeePerGas,
            gasLimit: 5000000,
          });
        await tx.wait();
        console.log("TRANSACTION HASH SWAP: " + tx.hash)
      } catch (error) {
        console.error("Error executing swap:", error.message);
      }

      const balanceWETH2 = await wethContract.balanceOf(owner.address);
      console.log("balanceWETH AFTER: ", balanceWETH2);
      await advanceTimeAndBlock(1200);
    }
    // hasnt updated yet, should be same
    console.log(price1);

    await advanceTimeAndBlock(twapPeriod * 10);

    const price2 = await oracle.latestAnswer();
    console.log(price2);

    // const priceAnswerAfter = await oracle.latestAnswer();
    // console.log("priceAnswerAfter: ", ethers.utils.formatUnits(priceAnswer, 18))
  });
});