import { ethers, upgrades } from "hardhat";
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
import _ from "lodash";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { advanceTimeAndBlock } from "../shared/helpers";
import { ComboOracle, ManualOracle, MockChainlinkAggregator, RadiantOFT, TestnetLockZap, UniV2TwapOracle, WETH } from "../../typechain-types";
import { targetPrice } from "../../config/31337";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { setupTest } from "../setup";
const { deployments } = require('hardhat');

chai.use(solidity);
const { expect } = chai;

const priceToJsNum = (oracleAnswer: BigNumber) => {
  return parseFloat(ethers.utils.formatUnits(oracleAnswer, 8))
}

describe("Uni V2 TWAP", () => {
  const { deploy, execute } = deployments;

  let oracle: UniV2TwapOracle;
  let lockZap: TestnetLockZap;
  let rdntToken: RadiantOFT;
  let weth: WETH;
  let chainlinkEthFeed: MockChainlinkAggregator;
  let period: number;
  let startingRdntPrice = targetPrice;
  let nonAdminUser: SignerWithAddress;
  let dao: SignerWithAddress;
  let deployer: SignerWithAddress;
  let testFallbackOracle: ManualOracle;

  before(async () => {
    const fixture = await setupTest();
    oracle = fixture.uniV2TwapOracle;
    lockZap = fixture.lockZap;
    rdntToken = fixture.rdntToken;
    weth = fixture.weth;
    nonAdminUser = fixture.user2;
    dao = fixture.dao;
    deployer = fixture.deployer;

    period = (await oracle.PERIOD()).toNumber();
    chainlinkEthFeed = <MockChainlinkAggregator>await ethers.getContractAt("MockChainlinkAggregator", fixture.deployConfig.CHAINLINK_ETH_USD_AGGREGATOR_PROXY);

    await deploy("ManualOracle", {
      from: deployer.address,
      log: true,
      proxy: {
        proxyContract: 'OpenZeppelinTransparentProxy',
        execute: {
          methodName: 'initialize',
          args: [
            rdntToken.address,
            chainlinkEthFeed.address
          ]
        },
      }
    });
    testFallbackOracle = <ManualOracle>await ethers.getContract("ManualOracle")
    await testFallbackOracle.setPrice(ethers.utils.parseEther("1"))
  })

  it("can be updated", async () => {

    await advanceTimeAndBlock(period);

    const canUpdate = await oracle.canUpdate();
    expect(canUpdate).equals(true);

    await expect(
      oracle.update()
    ).to.be.not.reverted;
  });

  it("returns price", async () => {

    await advanceTimeAndBlock(period);
    await oracle.update();

    const priceAnswer = await oracle.latestAnswer();
    expect(
      priceToJsNum(
        priceAnswer
      )
    ).to.be.closeTo(startingRdntPrice, .1);
  });

  it("LP token change reflected in price after update", async () => {

    const lots = ethers.utils.parseEther("10000000");
    await rdntToken.connect(dao).approve(lockZap.address, lots);
    await lockZap.connect(dao).sell(lots);

    const priceAnswer = await oracle.latestAnswer();

    // hasnt updated yet, should be same
    expect(
      priceToJsNum(
        priceAnswer
      )
    ).to.be.closeTo(startingRdntPrice, .1);

    await advanceTimeAndBlock(period);
    await oracle.update();

    const priceAnswerAfter = await oracle.latestAnswer();

    expect(
      priceToJsNum(
        priceAnswerAfter
      )
    ).to.be.lt(startingRdntPrice / 2);
  });

  it("can fallback", async () => {

    await advanceTimeAndBlock(period);
    await oracle.update();

    const pricePre = await oracle.latestAnswerInEth();

    await expect(
      oracle.enableFallback(true)
    ).to.be.revertedWith("no fallback set");

    await expect(
      oracle.connect(nonAdminUser).setFallback(testFallbackOracle.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await oracle.setFallback(testFallbackOracle.address);

    await expect(
      oracle.connect(nonAdminUser).enableFallback(true)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await oracle.enableFallback(true);

    const pricePost = await oracle.latestAnswerInEth();
    const expectedPrice = await testFallbackOracle.latestAnswerInEth()
    expect(pricePost).equals(expectedPrice);
    expect(pricePost).not.equals(pricePre);
  });

  it("can be used within a ComboOracle", async () => {

    await oracle.enableFallback(false);
    await advanceTimeAndBlock(period);
    await oracle.update();

    await deploy("ComboOracle", {
      from: deployer.address,
      log: true,
      proxy: {
        proxyContract: 'OpenZeppelinTransparentProxy',
        execute: {
          methodName: 'initialize',
          args: [
            rdntToken.address,
            chainlinkEthFeed.address
          ]
        },
      }
    });
    const comboOracle = <ComboOracle>await ethers.getContract("ComboOracle")
    await comboOracle.addSource(oracle.address);
    await comboOracle.addSource(testFallbackOracle.address);

    const twapPrice = await oracle.latestAnswerInEth();
    const manualPrice = await testFallbackOracle.latestAnswerInEth();

    const comboPrice = await comboOracle.latestAnswerInEth();
    const averagePrice = twapPrice.add(manualPrice).div(2);
    const lowestPrice = twapPrice.gt(manualPrice) ? manualPrice : twapPrice;
    let expectedPrice = averagePrice;
    if (averagePrice > (lowestPrice.mul(1025)).div(1000)) {
      expectedPrice = lowestPrice;
    }
    expect(comboPrice).equals(expectedPrice);
  });
});