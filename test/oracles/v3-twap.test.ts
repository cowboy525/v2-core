import { ethers } from "hardhat";
import _ from "lodash";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { advanceTimeAndBlock } from "../shared/helpers";
import { MockChainlinkAggregator, RadiantOFT, TestnetLockZap, UniV2TwapOracle, UniV3TwapOracle, WETH } from "../../typechain-types";
import { targetPrice } from "../../config/31337";
import { BigNumber } from "ethers";
import { setupTest } from "../setup";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

chai.use(solidity);
const { expect } = chai;

export const priceToJsNum = (oracleAnswer: BigNumber) => {
  return parseFloat(ethers.utils.formatUnits(oracleAnswer, 8))
}

describe("Uni V3 TWAP", () => {

  let oracle: UniV3TwapOracle;
  let lockZap: TestnetLockZap;
  let rdntToken: RadiantOFT;
  let weth: WETH;
  let chainlinkEthFeed: MockChainlinkAggregator;
  let dao: SignerWithAddress;
  let period: number;
  let startingRdntPrice = targetPrice;

  before(async () => {
    const fixture = await setupTest();
    oracle = fixture.uniV2TwapOracle;
    lockZap = fixture.lockZap;
    rdntToken = fixture.rdntToken;
    dao = fixture.dao;
    weth = fixture.weth;

    period = (await oracle.PERIOD()).toNumber();
    chainlinkEthFeed = <MockChainlinkAggregator>await ethers.getContractAt("MockChainlinkAggregator", fixture.deployConfig.CHAINLINK_ETH_USD_AGGREGATOR_PROXY);
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
});