import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import assert from "assert";
import { ethers } from "hardhat";
import {
  getLatestBlockTimestamp,
  setNextBlockTimestamp,
} from "../../scripts/utils";
import {
  LendingPool,
  MultiFeeDistribution,
  MFDstats,
  MiddleFeeDistribution,
  MockERC20,
  MockToken,
  AaveOracle,
  ERC20,
  ChefIncentivesController,
  LockerList,
} from "../../typechain-types";
import _ from "lodash";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber } from "ethers";
import {
  approxEqual,
  deployAndSetup,
  zapIntoEligibility,
} from "../shared/helpers";
import { DeployConfig, DeployData } from "../../scripts/deploy/types";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { setupTest } from "../setup";

chai.use(solidity);

describe("Check MFD Stats via Deposit/Borrow Cycles", () => {
  let user2: SignerWithAddress;
  let opEx: SignerWithAddress;
  let deployer: SignerWithAddress;

  let lendingPool: LendingPool;
  let middleFeeDistribution: MiddleFeeDistribution;
  let lpFeeDistribution: MultiFeeDistribution;
  let chefIncentivesController: ChefIncentivesController;
  let mfdStats: MFDstats;
  let aaveOracle: AaveOracle;
  let lpToken: ERC20;
  let bountyManagerAddr: string;
  let lpfdlockerlist: LockerList;
  let migrationAddr: string;

  let increasedUsdVal;
  let increasedLastDayTotal;

  let usdcAddress = "";
  let usdtAddress = "";
  let daiAddress = "";
  let wbtcAddress = "";

  const depAmt = 10000000;

  const opRatio = 1000;
  const oneDayInSecs = 86400;

  let deployData: DeployData;
  let deployConfig: DeployConfig;

  before(async () => {
    const fixture = await setupTest();

    deployData = fixture.deployData;
    deployConfig = fixture.deployConfig;

    user2 = fixture.user2;
    opEx = fixture.user3;
    deployer = fixture.deployer

    bountyManagerAddr = deployData.bountyManager;
    migrationAddr = deployData.migration;

    lendingPool = <LendingPool>(
      await ethers.getContractAt("LendingPool", deployData.lendingPool)
    );

    const list = await lendingPool.getReservesList();
    usdcAddress = fixture.usdc.address;
    usdtAddress = list[1];
    daiAddress = list[2];
    wbtcAddress = list[3];

    chefIncentivesController = <ChefIncentivesController>(
      await ethers.getContractAt("ChefIncentivesController", deployData.chefIncentivesController)
    );

    lpFeeDistribution = <MultiFeeDistribution>(
      await ethers.getContractAt(
        "MultiFeeDistribution",
        deployData.lpFeeDistribution!
      )
    );
    lpfdlockerlist = <LockerList>(
      await ethers.getContractAt(
        "LockerList",
        await lpFeeDistribution.userlist()
      )
    );
    middleFeeDistribution = <MiddleFeeDistribution>(
      await ethers.getContractAt(
        "MiddleFeeDistribution",
        deployData.middleFeeDistribution!
      )
    );

    mfdStats = <MFDstats>(
      await ethers.getContractAt("MFDstats", deployData.mfdStats!)
    );

    aaveOracle = <AaveOracle>(
      await ethers.getContractAt("AaveOracle", deployData.aaveOracle)
    );

    await middleFeeDistribution.setOperationExpenses(opEx.address, opRatio);
    lpToken = await ethers.getContractAt("ERC20", fixture.deployData.stakingToken);
  });

  it("Last Day total when empty", async () => {
    const lastDayTotal = await mfdStats.getLastDayTotal();
    assert.equal(lastDayTotal.length, 1, `must be one`);
  });

  it("Lock LP and Check Locked Supply", async () => {
    await zapIntoEligibility(user2, deployData, "10");

    const lockedBal = (await lpFeeDistribution.lockedBalances(user2.address))
      .locked;
    const lockerCount = await lpfdlockerlist.lockersCount();
    const totalLockedLPValue = await lpFeeDistribution.lockedSupply();

    assert.equal(
      lockedBal.toString(),
      totalLockedLPValue.toString(),
      `Locked Supply`
    );
    assert.equal(lockerCount.toNumber(), 1, `Locked Count checks`);
  });

  const depositCycle = async (assetAddress: string) => {
    const Asset = <MockToken>(
      await ethers.getContractAt("MockToken", assetAddress)
    );
    const tokenDecimals = await Asset.decimals();
    const tokenPerAccount = ethers.utils.parseUnits(
      depAmt.toString(),
      tokenDecimals
    );
    const borrowAmt = ethers.utils.parseUnits(
      (depAmt * 0.5).toString(),
      tokenDecimals
    );

    await Asset.connect(user2).mint(user2.address, tokenPerAccount);
    await Asset.connect(user2).approve(
      lendingPool.address,
      ethers.constants.MaxUint256
    );
    await lendingPool
      .connect(user2)
      .deposit(assetAddress, tokenPerAccount, user2.address, 0);
    await lendingPool
      .connect(user2)
      .borrow(assetAddress, borrowAmt, 2, 0, user2.address);
  };

  const borrowCycle = async (
    assetAddress: string,
    rTokenAddress: string,
    borrowAmt: string
  ) => {
    const Asset = <MockToken>(
      await ethers.getContractAt("MockToken", assetAddress)
    );

    const smallBorrowAmt = ethers.utils.parseUnits(
      borrowAmt,
      await Asset.decimals()
    );

    await zapIntoEligibility(user2, deployData, "1");

    await lendingPool
      .connect(user2)
      .borrow(assetAddress, smallBorrowAmt, 2, 0, user2.address);
  };

  it("Check Last Day Total", async () => {
    const assetAddress = usdcAddress;
    const rTokenAddress = deployData.allTokens.rUSDC;
    const Asset = <MockToken>(
      await ethers.getContractAt("MockToken", assetAddress)
    );
    const rToken = <MockERC20>(
      await ethers.getContractAt("mockERC20", rTokenAddress)
    );

    const initBal = await rToken.balanceOf(middleFeeDistribution.address);
    const initLastDayTotal = await mfdStats.getLastDayTotal();

    await depositCycle(usdcAddress);
    const newlastDayTotal = await mfdStats.getLastDayTotal();
    assert.equal(newlastDayTotal.length, 1, `must be 1`);

    await setNextBlockTimestamp(
      (await getLatestBlockTimestamp()) + (oneDayInSecs - 100)
    );
    await borrowCycle(assetAddress, rTokenAddress, "1");

    const priceDecimals = await mfdStats.getPriceDecimal(assetAddress);
    const increasedBal = await rToken.balanceOf(middleFeeDistribution.address);
    const tokenPrice = await aaveOracle.getAssetPrice(Asset.address);
    const tokenDecimals = await Asset.decimals();
    increasedUsdVal = increasedBal
      .sub(initBal)
      .mul(tokenPrice)
      .mul(BigNumber.from(BigInt(10 ** 18)))
      .div(BigNumber.from(BigInt(10 ** tokenDecimals)))
      .div(BigNumber.from(BigInt(10 ** parseInt(priceDecimals.toString()))));
    const operationExpenseRatio =
      await middleFeeDistribution.operationExpenseRatio();

    const lastDayTotal = await mfdStats.getLastDayTotal();
    increasedLastDayTotal = lastDayTotal[0].lpUsdValue.sub(
      initLastDayTotal[0].lpUsdValue
    );

    assert.equal(
      approxEqual(
        increasedLastDayTotal,
        increasedUsdVal.sub(increasedUsdVal.mul(operationExpenseRatio).div(1e4))
      ),
      true,
      `Total Interest Checks.`
    );
  });

  it("Check Total Interest with Multiple Days", async () => {
    const assetAddress = usdtAddress;
    const rTokenAddress = deployData.allTokens.rUSDT;
    const Asset = <MockToken>(
      await ethers.getContractAt("MockToken", assetAddress)
    );
    const rToken = <MockERC20>(
      await ethers.getContractAt("mockERC20", rTokenAddress)
    );

    const initBal = await rToken.balanceOf(middleFeeDistribution.address);
    const initTotal = await mfdStats.getTotal();
    const priceDecimals = await mfdStats.getPriceDecimal(assetAddress);

    await depositCycle(assetAddress);

    await setNextBlockTimestamp((await getLatestBlockTimestamp()) + 864000 * 2);

    await borrowCycle(assetAddress, rTokenAddress, "1");

    const increasedBal = await rToken.balanceOf(middleFeeDistribution.address);
    const tokenPrice = await aaveOracle.getAssetPrice(Asset.address);
    const tokenDecimals = await Asset.decimals();
    increasedUsdVal = increasedBal
      .sub(initBal)
      .mul(tokenPrice)
      .mul(BigNumber.from(BigInt(10 ** 18)))
      .div(BigNumber.from(BigInt(10 ** tokenDecimals)))
      .div(BigNumber.from(BigInt(10 ** priceDecimals)));

    const operationExpenseRatio =
      await middleFeeDistribution.operationExpenseRatio();

    const total = await mfdStats.getTotal();
    const increasedTotal = total[0].lpUsdValue.sub(initTotal[0].lpUsdValue);

    assert.equal(
      approxEqual(
        increasedTotal,
        increasedUsdVal.sub(increasedUsdVal.mul(operationExpenseRatio).div(1e4))
      ),
      true,
      `Total Interest Checks.`
    );
  });

  it("Check Total Interest Per Asset Breakdown", async () => {
    const assetAddresses = [wbtcAddress, daiAddress];
    const rTokenAddresses = [
      deployData.allTokens.rWBTC,
      deployData.allTokens.rDAI,
    ];
    const Assets = [];
    const rTokens = [];
    const initBalPerAsset = [];
    const initTotalPerAsset = [];

    const initTotal = await mfdStats.getTotal();

    for (let i = 0; i < assetAddresses.length; i++) {
      Assets.push(
        <MockToken>await ethers.getContractAt("MockToken", assetAddresses[i])
      );
      rTokens.push(
        <MockERC20>await ethers.getContractAt("mockERC20", rTokenAddresses[i])
      );

      initBalPerAsset.push(
        await rTokens[i].balanceOf(middleFeeDistribution.address)
      );

      const perAsset = initTotal.filter(
        (item) => item.assetAddress == assetAddresses[i]
      );
      initTotalPerAsset.push(perAsset.length ? perAsset[0].lpUsdValue : 0);

      await depositCycle(assetAddresses[i]);

      await setNextBlockTimestamp((await getLatestBlockTimestamp()) + 4000);

      await borrowCycle(
        assetAddresses[i],
        rTokenAddresses[i],
        (i + 1).toString()
      );

      const total = await mfdStats.getTotal();

      const increasedBal = await rTokens[i].balanceOf(
        middleFeeDistribution.address
      );
      const tokenPrice = await aaveOracle.getAssetPrice(assetAddresses[i]);
      const tokenDecimals = await Assets[i].decimals();
      const priceDecimals = await mfdStats.getPriceDecimal(assetAddresses[i]);

      const totalPerAsset = total.filter(
        (item) => item.assetAddress == assetAddresses[i]
      )[0].lpUsdValue;

      const increasedUsdVal = increasedBal
        .sub(initBalPerAsset[i])
        .mul(tokenPrice)
        .mul(BigNumber.from(BigInt(10 ** 18)))
        .div(BigNumber.from(BigInt(10 ** tokenDecimals)))
        .div(BigNumber.from(BigInt(10 ** priceDecimals)));
      const increasedTotal = totalPerAsset.sub(initTotalPerAsset[i]);

      const operationExpenseRatio =
        await middleFeeDistribution.operationExpenseRatio();

      const tokenSymbol = await Assets[i].symbol();

      assert.equal(
        approxEqual(
          increasedTotal,
          increasedUsdVal.sub(
            increasedUsdVal.mul(operationExpenseRatio).div(1e4)
          ),
          1
        ),
        true,
        `Total Interest Checks Per ${tokenSymbol}`
      );
    }
  });

  it("addTransfer with time advance", async () => {
    const assetAddress = usdcAddress;
    const rTokenAddress = deployData.allTokens.rUSDC;
    await depositCycle(usdcAddress);
    await setNextBlockTimestamp(
      (await getLatestBlockTimestamp()) + (oneDayInSecs + 100)
    );
    assert.equal(
      (await mfdStats.getLastDayTotal()).length > 2,
      true,
      `must be more than 2`
    );

    await depositCycle(usdcAddress);
    assert.equal(
      (await mfdStats.getLastDayTotal()).length > 2,
      true,
      `must be more than 2`
    );
    await setNextBlockTimestamp(
      (await getLatestBlockTimestamp()) + (oneDayInSecs + 100)
    );
    await borrowCycle(assetAddress, rTokenAddress, "1");
    assert.equal(
      (await mfdStats.getLastDayTotal()).length > 2,
      true,
      `must be more than 2`
    );
    await setNextBlockTimestamp(
      (await getLatestBlockTimestamp()) + (oneDayInSecs + 100)
    );
    assert.equal(
      (await mfdStats.getLastDayTotal()).length > 2,
      true,
      `must be more than 2`
    );
    await depositCycle(usdcAddress);
    assert.equal(
      (await mfdStats.getLastDayTotal()).length > 2,
      true,
      `must be more than 2`
    );
    await setNextBlockTimestamp(
      (await getLatestBlockTimestamp()) + (oneDayInSecs + 100)
    );
    await borrowCycle(assetAddress, rTokenAddress, "1");
  });

  it("addTransfer with zero expense", async () => {
    await middleFeeDistribution.setOperationExpenses(
      ethers.constants.AddressZero,
      0
    );
    await depositCycle(usdcAddress);
  });

  it("check circulating supply", async () => {
    const circulatingSupplyBefore = await mfdStats.getCirculatingSupply(
      chefIncentivesController.address,
      bountyManagerAddr,
      migrationAddr
    );
    await lpToken.approve(lpFeeDistribution.address, 100000)
    await lpFeeDistribution.stake(10000, deployer.address, 0);
    const circulatingSupplyAfter = await mfdStats.getCirculatingSupply(
      chefIncentivesController.address,
      bountyManagerAddr,
      migrationAddr
    );
    assert.equal(circulatingSupplyBefore.sub(circulatingSupplyAfter).gt(0), true);
  })
});
