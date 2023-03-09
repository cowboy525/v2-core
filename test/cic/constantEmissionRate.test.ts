import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { EligibilityDataProvider } from "../../typechain-types";
import _ from "lodash";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import {
  advanceTimeAndBlock,
  depositAndBorrowAll,
  getLatestBlockTimestamp,
  getTotalPendingRewards,
  zapIntoEligibility,
} from "../shared/helpers";
import { DeployConfig, DeployData } from "../../scripts/deploy/types";
import { ChefIncentivesController } from "../../typechain-types/contracts/staking";
import { setupTest } from "../setup";

chai.use(solidity);

describe("Ensure Emissions consistant", () => {
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let eligibilityProvider: EligibilityDataProvider;
  let cic: ChefIncentivesController;
  let deployData: DeployData;
  let deployConfig: DeployConfig;

  before(async () => {
    const fixture = await setupTest();

    deployData = fixture.deployData;
    deployConfig = fixture.deployConfig;

    user2 = fixture.user2;
    user1 = fixture.deployer;

    cic = fixture.chefIncentivesController;
    eligibilityProvider = fixture.eligibilityProvider;

    await cic.setEligibilityEnabled(false);
  });

  it("user1 emission rate unchanged after user2 deposits", async () => {
		await depositAndBorrowAll(user2, [".000000001", ".0000000000001"], deployData);
		await zapIntoEligibility(user2, deployData);

		const startTimestamp = await getLatestBlockTimestamp();

		expect(
      await eligibilityProvider.isEligibleForRewards(user2.address)
    ).to.be.equal(true);

    const SKIP_DURATION = 120;
    await advanceTimeAndBlock(SKIP_DURATION);

    const pendingRewards1 = await getTotalPendingRewards(user2.address, cic);
    const expectedRewards1 = deployConfig.CIC_RPS.mul(SKIP_DURATION);

    expect(
      parseInt(ethers.utils.formatUnits(pendingRewards1.toString(), 18))
    ).to.be.approximately(
      parseInt(ethers.utils.formatUnits(expectedRewards1.toString(), 18)),
      3
    );

    await depositAndBorrowAll(user1, ["150", "10000000"], deployData);

    await advanceTimeAndBlock(SKIP_DURATION);
    const currentTimestamp = await getLatestBlockTimestamp();
    const DURATION = currentTimestamp - startTimestamp;

    const pendingRewards2 = await getTotalPendingRewards(user2.address, cic);

    const emissionRate2 = pendingRewards2.div(DURATION);
    expect(emissionRate2).to.be.not.equal(deployConfig.CIC_RPS);
  });
});
