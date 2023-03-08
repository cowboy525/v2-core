import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { advanceTimeAndBlock } from "../../scripts/utils";
import { MultiFeeDistribution } from "../../typechain-types";
import _ from "lodash";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { DeployData } from "../../scripts/deploy/types";
import {
  depositAndBorrowAll,
  zapIntoEligibility,
} from "../shared/helpers";
import { PriceProvider } from "../../typechain-types/contracts/price";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { setupTest } from "../setup";

chai.use(solidity);

describe("Default Relock", () => {
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  let mfd: MultiFeeDistribution;
  let lpFeeDistribution: MultiFeeDistribution;
  let priceProvider: PriceProvider;

  let LOCK_DURATION = 0;
  let REWARDS_DURATION = 0;

  let deployData: DeployData;

  beforeEach(async () => {
    const fixture = await setupTest();

    deployData = fixture.deployData;

    user2 = fixture.user2;
    user3 = fixture.user3;

    mfd = fixture.multiFeeDistribution;
    lpFeeDistribution = fixture.lpFeeDistribution;
    priceProvider = fixture.priceProvider;

    REWARDS_DURATION = (await mfd.REWARDS_DURATION()).toNumber();
    LOCK_DURATION = (await mfd.DEFAULT_LOCK_DURATION()).toNumber();

    // await chef.setDisableEligibilty(true);
    // await chef.setRewardsPerSecond("1000000000000000000", true);
  });

  it("relock", async () => {
    const bigDepositor = user2;
    const locker = user3;

    await depositAndBorrowAll(bigDepositor, ["100", "100000"], deployData);

    await zapIntoEligibility(locker, deployData, "10");

    await advanceTimeAndBlock(LOCK_DURATION / 4);
    await depositAndBorrowAll(bigDepositor, ["1000", "10000000"], deployData);

    await advanceTimeAndBlock(LOCK_DURATION / 4);
    await depositAndBorrowAll(bigDepositor, ["1000", "10000000"], deployData);

    // needs at least 1 claim to forward to MFD from MiddleFee
    await lpFeeDistribution.connect(locker).getAllRewards();
    await advanceTimeAndBlock(LOCK_DURATION / 4);

    await advanceTimeAndBlock(LOCK_DURATION / 4);
    await depositAndBorrowAll(bigDepositor, ["1000", "10000000"], deployData);

    await advanceTimeAndBlock(LOCK_DURATION);

    await zapIntoEligibility(locker, deployData, "10");

    // TODO: check they have 2 locks (one relocked)
  });
});
