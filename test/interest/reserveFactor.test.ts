/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { advanceTime, advanceTimeAndBlock } from "../../scripts/utils";
import {
  ATokensAndRatesHelper,
  LendingPool,
  LendingPoolAddressesProvider,
  MultiFeeDistribution,
  MiddleFeeDistribution,
  MockERC20,
  MockToken,
  RadiantOFT,
} from "../../typechain";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber } from "ethers";
import { DeployConfig, DeployData } from "../../scripts/deploy/types";
import { setupTest } from "../setup";

chai.use(solidity);
const { expect } = chai;

describe("Reserve Factor", () => {
  let deployer: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  let USDC: MockToken;

  let rUSDC: MockERC20;
  let lendingPool: LendingPool;
  let multiFeeDistribution: MultiFeeDistribution;
  let middleFeeDistribution: MiddleFeeDistribution;
  let radiantToken: RadiantOFT;
  let aTokensAndRatesHelper: ATokensAndRatesHelper;
  let lendingPoolAddressesProvider: LendingPoolAddressesProvider;

  let usdcAddress = "";
  const usdcPerAccount = ethers.utils.parseUnits("100000000", 6);
  const borrowAmt = ethers.utils.parseUnits("10000000", 6);

  const skipDuration = 10000;

  let reward0: BigNumber;
  let reward1;

  let deployData: DeployData;
  let deployConfig: DeployConfig;

  beforeEach(async () => {
    const fixture = await setupTest();

    deployData = fixture.deployData;
    deployConfig = fixture.deployConfig;

    deployer = fixture.deployer;
    user2 = fixture.user2;
    user3 = fixture.user3;

    usdcAddress = fixture.usdc.address;

    USDC = <MockToken>await ethers.getContractAt("MockToken", usdcAddress);
    rUSDC = <MockERC20>(
      await ethers.getContractAt("mockERC20", deployData.allTokens.rUSDC)
    );
    aTokensAndRatesHelper = <ATokensAndRatesHelper>await ethers.getContractAt(
      "ATokensAndRatesHelper",
      deployData.aTokensAndRatesHelper!
    );
    lendingPoolAddressesProvider = <LendingPoolAddressesProvider>(
      await ethers.getContractAt(
        "LendingPoolAddressesProvider",
        deployData.lendingPoolAddressesProvider!
      )
    )
    lendingPool = fixture.lendingPool;
    multiFeeDistribution = fixture.multiFeeDistribution;
    radiantToken = fixture.rdntToken;
    middleFeeDistribution = fixture.middleFeeDistribution;

    const LPToken = <MockToken>await ethers.getContractAt("MockToken", deployData.stakingToken);
    await LPToken.approve(multiFeeDistribution.address, ethers.constants.MaxUint256);
    await multiFeeDistribution.stake(ethers.utils.parseEther("10"), deployer.address, 0);
    // skip initial delay
    await advanceTimeAndBlock(4000);

    await USDC.mint(user2.address, usdcPerAccount);
    await USDC.mint(user3.address, usdcPerAccount);

    await USDC.connect(user2).approve(
      lendingPool.address,
      ethers.constants.MaxUint256
    );
    await radiantToken
      .connect(user2)
      .approve(multiFeeDistribution.address, ethers.constants.MaxUint256);

    await USDC.connect(user3).approve(
      lendingPool.address,
      ethers.constants.MaxUint256
    );
    await radiantToken
      .connect(user3)
      .approve(multiFeeDistribution.address, ethers.constants.MaxUint256);

    await lendingPool
      .connect(user2)
      .deposit(usdcAddress, usdcPerAccount.div(10), user2.address, 0);

    await lendingPool
      .connect(user3)
      .deposit(usdcAddress, usdcPerAccount, user3.address, 0);

    await lendingPool
      .connect(user3)
      .borrow(usdcAddress, borrowAmt, 2, 0, user3.address);
  });

  const configureReserves = async (reserveFactor: number) => {
    await lendingPoolAddressesProvider.setPoolAdmin(
      aTokensAndRatesHelper.address
    )
    // configureReserves
    const TOKENS_CONFIG = new Map<string, any>(deployConfig.TOKENS_CONFIG);
    const inputParams = [];
    for (const [key, value] of TOKENS_CONFIG) {
      const tokenAddress = TOKENS_CONFIG.get(key)!.assetAddress;
      const {
        baseLTVAsCollateral,
        liquidationBonus,
        liquidationThreshold,
        _,
        stableBorrowRateEnabled,
        borrowingEnabled,
      } = value.reservesParams;

      if (baseLTVAsCollateral === "-1") continue;

      inputParams.push({
        asset: tokenAddress,
        baseLTV: baseLTVAsCollateral,
        liquidationThreshold: liquidationThreshold,
        liquidationBonus: liquidationBonus,
        reserveFactor: reserveFactor,
        stableBorrowingEnabled: stableBorrowRateEnabled,
        borrowingEnabled: borrowingEnabled,
      });
    }
    // patch
    inputParams[0].asset = usdcAddress;

    await aTokensAndRatesHelper.configureReserves(inputParams);
  }

  it("50% RV test", async () => {
    await configureReserves(5000);
    const mintBal0 = await rUSDC.balanceOf(middleFeeDistribution.address);
    await advanceTime(skipDuration);
    await lendingPool
      .connect(user2)
      .deposit(usdcAddress, usdcPerAccount.div(10), user2.address, 0);
    const mintBal1 = await rUSDC.balanceOf(middleFeeDistribution.address);

    reward0 = mintBal1.sub(mintBal0);
  });

  it("Can change to 70%", async () => {
    await configureReserves(7000);
    const mintBal0 = await rUSDC.balanceOf(middleFeeDistribution.address);
    await advanceTime(skipDuration);
    await lendingPool
      .connect(user2)
      .deposit(usdcAddress, usdcPerAccount.div(10), user2.address, 0);
    const mintBal1 = await rUSDC.balanceOf(middleFeeDistribution.address);

    reward1 = mintBal1.sub(mintBal0);

    const expected = reward0.mul(7000).div(5000);
    // in a range due to roundings
    const expectedNum = parseFloat(ethers.utils.formatUnits(expected, 6))
    const reward1Num = parseFloat(ethers.utils.formatUnits(reward1, 6))
    expect(expectedNum).to.be.approximately(reward1Num, 1);
  });

});
