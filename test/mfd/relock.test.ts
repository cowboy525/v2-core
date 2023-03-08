import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import assert from "assert";
import { advanceTimeAndBlock } from "../../scripts/utils";
import { BountyManager, LockerList, MFDPlus, ERC20, Leverager, WETH, VariableDebtToken, WETHGateway, LendingPool } from "../../typechain-types";
import _ from "lodash";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { DeployData } from "../../scripts/deploy/types";
import { zapIntoEligibility } from "../shared/helpers";
import { ethers } from "hardhat";
import { setupTest } from "../setup";

chai.use(solidity);
const { expect } = chai;

describe("MFD Relocking", () => {
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let lpFeeDistribution: MFDPlus;
  let bountyManager: BountyManager;
  let leverager: Leverager;
  let wethGateway: WETHGateway;
  let weth: WETH;
  let lendingPool: LendingPool;
  let vdWETH: VariableDebtToken;
  let lockerlist: LockerList;
  let lpToken: ERC20;

  let deployData: DeployData;

  before(async () => {
    ({
      lpFeeDistribution,
      leverager,
      weth,
      wethGateway,
      deployData,
      lendingPool,
      bountyManager,
      user2,
      user3,
    } = await setupTest());

    lockerlist = <LockerList>await ethers.getContractAt("LockerList", await lpFeeDistribution.userlist());
    lpToken = await ethers.getContractAt("ERC20", deployData.stakingToken);
  });

  it("Withdraw Expired Locks; disabling auto relock at first is saved", async () => {
    await zapIntoEligibility(user2, deployData);
    await lpFeeDistribution.connect(user2).setRelock(false);

    let lockedBal = (await lpFeeDistribution.lockedBalances(user2.address))
      .locked;
    const lockerCount = await lockerlist.lockersCount();
    const totalLockedLPValue = await lpFeeDistribution.lockedSupply();

    assert.equal(
      lockedBal.toString(),
      totalLockedLPValue.toString(),
      `Locked Supply`
    );
    assert.equal(lockerCount.toNumber(), 1, `Locked Count checks`);

    const lockDuration = await lpFeeDistribution.DEFAULT_LOCK_DURATION();

    await advanceTimeAndBlock(parseInt(lockDuration.toString()));

    lockedBal = (await lpFeeDistribution.lockedBalances(user2.address)).locked;
    assert.equal(lockedBal.toString(), "0", `Locking expired`);

    await lpFeeDistribution
      .connect(user2)
      .withdrawExpiredLocksFor(user2.address);

    lockedBal = (await lpFeeDistribution.lockedBalances(user2.address)).locked;
    expect(lockedBal).to.be.eq(0, "Didn't withdraw properly");
  });

  it("Relock happens automatically at Withdraw ", async () => {
    await zapIntoEligibility(user2, deployData);

    let lockedBal = (await lpFeeDistribution.lockedBalances(user2.address))
      .locked;
    const lockerCount = await lockerlist.lockersCount();
    const totalLockedLPValue = await lpFeeDistribution.lockedSupply();

    assert.equal(
      lockedBal.toString(),
      totalLockedLPValue.toString(),
      `Locked Supply`
    );
    assert.equal(lockerCount.toNumber(), 1, `Locked Count checks`);

    const lockDuration = await lpFeeDistribution.DEFAULT_LOCK_DURATION();

    await advanceTimeAndBlock(parseInt(lockDuration.toString()));

    lockedBal = (await lpFeeDistribution.lockedBalances(user2.address)).locked;
    const relockable = (await lpFeeDistribution.lockedBalances(user2.address))
      .unlockable;
    assert.equal(lockedBal.toString(), "0", `Locking expired`);

    await lpFeeDistribution.connect(user2).setRelock(true);
    await lpFeeDistribution
      .connect(user2)
      .withdrawExpiredLocksFor(user2.address);

    lockedBal = (await lpFeeDistribution.lockedBalances(user2.address)).locked;
    expect(lockedBal).to.be.eq(relockable, "Didn't relock properly");
  });

  it("Force Relock happens at Withdraw ", async () => {
    await zapIntoEligibility(user2, deployData);

    let lockedBal = (await lpFeeDistribution.lockedBalances(user2.address))
      .locked;
    const lockerCount = await lockerlist.lockersCount();
    const totalLockedLPValue = await lpFeeDistribution.lockedSupply();

    assert.equal(
      lockedBal.toString(),
      totalLockedLPValue.toString(),
      `Locked Supply`
    );
    assert.equal(lockerCount.toNumber(), 1, `Locked Count checks`);

    const lockDuration = await lpFeeDistribution.DEFAULT_LOCK_DURATION();

    await advanceTimeAndBlock(parseInt(lockDuration.toString()));

    lockedBal = (await lpFeeDistribution.lockedBalances(user2.address)).locked;
    assert.equal(lockedBal.toString(), "0", `Locking expired`);

    await lpFeeDistribution.connect(user2).setRelock(true);
    await lpFeeDistribution
      .connect(user2)
      .withdrawExpiredLocksForWithOptions(user2.address, 0, true);

    lockedBal = (await lpFeeDistribution.lockedBalances(user2.address)).locked;
    expect(lockedBal).to.be.eq(0, "Didn't relock properly");
  });

  it("Auto Relock doesn't happen when disabled ", async () => {
    await zapIntoEligibility(user2, deployData);

    let lockedBal = (await lpFeeDistribution.lockedBalances(user2.address))
      .locked;
    const lockerCount = await lockerlist.lockersCount();
    const totalLockedLPValue = await lpFeeDistribution.lockedSupply();

    assert.equal(
      lockedBal.toString(),
      totalLockedLPValue.toString(),
      `Locked Supply`
    );
    assert.equal(lockerCount.toNumber(), 1, `Locked Count checks`);

    const lockDuration = await lpFeeDistribution.DEFAULT_LOCK_DURATION();

    await advanceTimeAndBlock(parseInt(lockDuration.toString()));

    lockedBal = (await lpFeeDistribution.lockedBalances(user2.address)).locked;
    assert.equal(lockedBal.toString(), "0", `Locking expired`);

    await lpFeeDistribution.connect(user2).setRelock(false);
    await lpFeeDistribution
      .connect(user2)
      .withdrawExpiredLocksFor(user2.address);

    lockedBal = (await lpFeeDistribution.lockedBalances(user2.address)).locked;
    expect(lockedBal).to.be.eq(0, "Didn't relock properly");
  });

  it("Relock Expired Locks", async () => {
    await zapIntoEligibility(user2, deployData);

    let lockedBal = (await lpFeeDistribution.lockedBalances(user2.address))
      .locked;
    const lockerCount = await lockerlist.lockersCount();
    const totalLockedLPValue = await lpFeeDistribution.lockedSupply();

    assert.equal(
      lockedBal.toString(),
      totalLockedLPValue.toString(),
      `Locked Supply`
    );
    assert.equal(lockerCount.toNumber(), 1, `Locked Count checks`);

    const lockDuration = await lpFeeDistribution.DEFAULT_LOCK_DURATION();

    await advanceTimeAndBlock(parseInt(lockDuration.toString()));

    lockedBal = (await lpFeeDistribution.lockedBalances(user2.address)).locked;
    assert.equal(lockedBal.toString(), "0", `Locking expired`);

    await lpFeeDistribution.connect(user2).setRelock(true);
    await lpFeeDistribution
      .connect(user3)
      .withdrawExpiredLocksFor(user2.address);

    lockedBal = (await lpFeeDistribution.lockedBalances(user2.address)).locked;

    let u3LockedBal = (await lpFeeDistribution.lockedBalances(user3.address))
      .locked;
    expect(u3LockedBal).to.be.eq(0, "user3 get nothing");

    await lpFeeDistribution
      .connect(user3)
      .withdrawExpiredLocksFor(user3.address);
    u3LockedBal = (await lpFeeDistribution.lockedBalances(user3.address))
      .locked;
    expect(u3LockedBal).to.be.eq(0, "user3 get nothing");
  });

  it("Auto Relock happens at claimed bounty ", async () => {
    await zapIntoEligibility(user2, deployData);

    let lockedBal = (await lpFeeDistribution.lockedBalances(user2.address))
      .locked;
    const lockerCount = await lockerlist.lockersCount();
    const totalLockedLPValue = await lpFeeDistribution.lockedSupply();

    assert.equal(
      lockedBal.toString(),
      totalLockedLPValue.toString(),
      `Locked Supply`
    );
    assert.equal(lockerCount.toNumber(), 1, `Locked Count checks`);

    const lockDuration = await lpFeeDistribution.DEFAULT_LOCK_DURATION();
    await advanceTimeAndBlock(parseInt(lockDuration.toString()) * 2);

    const bountyAmount = await bountyManager.quote(user2.address);
    // console.log("Bounty:", bountyAmount.toString());
    const minDLPBalance = await bountyManager.minDLPBalance();
    await lpToken.approve(lpFeeDistribution.address, minDLPBalance)
    await lpFeeDistribution.stake(minDLPBalance, user3.address, 0);

    let vdWETHAddress = await leverager.getVDebtToken(weth.address);
    vdWETH = <VariableDebtToken>(
      await ethers.getContractAt("VariableDebtToken", vdWETHAddress)
    );
    await vdWETH
      .connect(user3)
      .approveDelegation(leverager.address, ethers.constants.MaxUint256);

    await wethGateway
      .connect(user3)
      .depositETHWithAutoDLP(lendingPool.address, user3.address, 0, {
        value: ethers.utils.parseEther("1"),
      });

    await bountyManager.connect(user3).claim(user2.address, bountyAmount.bounty, 0)

    await advanceTimeAndBlock(parseInt(lockDuration.toString()));

    lockedBal = (await lpFeeDistribution.lockedBalances(user2.address)).locked;
    const relockable = (await lpFeeDistribution.lockedBalances(user2.address))
      .unlockable;
    assert.equal(lockedBal.toString(), "0", `Locking expired`);

    await lpFeeDistribution.connect(user2).setRelock(true);
    await lpFeeDistribution
      .connect(user2)
      .withdrawExpiredLocksFor(user2.address);

    lockedBal = (await lpFeeDistribution.lockedBalances(user2.address)).locked;
    expect(lockedBal).to.be.eq(relockable, "Didn't relock properly");
  });
});
