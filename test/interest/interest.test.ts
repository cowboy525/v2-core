import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import assert from "assert";
import { ethers } from "hardhat";
import {
  getLatestBlockTimestamp,
  setNextBlockTimestamp,
} from "../../scripts/utils";
import { LendingPool, MFDstats, MockToken } from "../../typechain-types";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { getUsdVal } from "./../shared/helpers";
import { DeployConfig, DeployData } from "../../scripts/deploy/types";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { setupTest } from "../setup";

chai.use(solidity);

xdescribe("Interest split 75/25 between lockers and depositors", () => {
  let deployData: DeployData;
  let deployConfig: DeployConfig;

  let user2: SignerWithAddress;
  let USDC: MockToken;
  let lendingPool: LendingPool;
  let mfdStats: MFDstats;
  let usdcAddress = "";
  const usdcAmt = 10000000;
  const usdcPerAccount = ethers.utils.parseUnits(usdcAmt.toString(), 6);
  const borrowAmt = ethers.utils.parseUnits((usdcAmt * 0.5).toString(), 6);

  before(async () => {
    const fixture = await setupTest();

    deployData = fixture.deployData;
    deployConfig = fixture.deployConfig;

    user2 = fixture.user2;

    USDC = fixture.usdc;
    usdcAddress = USDC.address;

    lendingPool = fixture.lendingPool;
    mfdStats = await ethers.getContractAt("MFDstats", deployData.mfdStats!);
  });

  it("lockers get 75% of interest", async () => {
    const priceDecimals = await mfdStats.getPriceDecimal(usdcAddress);
    await USDC.connect(user2).mint(user2.address, usdcPerAccount);

    await USDC.connect(user2).approve(
      lendingPool.address,
      ethers.constants.MaxUint256
    );

    await lendingPool
      .connect(user2)
      .deposit(usdcAddress, usdcPerAccount, user2.address, 0);

    await lendingPool
      .connect(user2)
      .borrow(usdcAddress, borrowAmt, 2, 0, user2.address);

    const r2 = await lendingPool.getUserAccountData(user2.address);
    const startDepUsd = getUsdVal(r2.totalCollateralETH, priceDecimals);

    await setNextBlockTimestamp(
      (await getLatestBlockTimestamp()) + 86400 * 365
    );

    await lendingPool
      .connect(user2)
      .borrow(usdcAddress, 1, 2, 0, user2.address);

    const r3 = await lendingPool.getUserAccountData(user2.address);
    const endDepUsd = getUsdVal(r3.totalCollateralETH, priceDecimals);

    const depositorEarnedUsd = parseFloat(endDepUsd) - parseFloat(startDepUsd);

    const paidToLockers = parseFloat(
      getUsdVal((await mfdStats.getTotal())[0].lpUsdValue, 18)
    );
    const totalInterest = paidToLockers + depositorEarnedUsd;

    const lockerInterestPercent = paidToLockers / totalInterest;
    const targetLockerInterestPercent = 0.75;
    const delta = Math.abs(lockerInterestPercent - targetLockerInterestPercent);
    console.log(lockerInterestPercent);
    console.log(targetLockerInterestPercent);
    console.log(delta);

    assert(delta <= 0.1, "Lockers get 70%");
  });
});
