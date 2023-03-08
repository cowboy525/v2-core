import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import {
  LendingPool,
  MultiFeeDistribution,
  RadiantOFT,
  VariableDebtToken,
  LockZap,
  WETH,
} from "../../typechain-types";
import { expect } from "chai";
import { setupTest } from "../setup";

describe("LockZap: 2-token zap", function () {
  let dao: SignerWithAddress;
  let lockZap: LockZap;
  let weth: WETH;
  let lendingPool: LendingPool;
  let rdntToken: RadiantOFT;
  let lpFeeDistribution: MultiFeeDistribution;

  beforeEach(async function () {
    ({
      dao,
      rdntToken,
      lendingPool,
      lockZap,
      weth,
      lpFeeDistribution
    } = await setupTest());

    // setup for a borrow
    const depositAmt = ethers.utils.parseUnits("100000", 18);
    await weth.connect(dao).mint(depositAmt);

    await weth.connect(dao).approve(
      lendingPool.address,
      ethers.constants.MaxUint256
    );
    await lendingPool
      .connect(dao)
      .deposit(weth.address, depositAmt, dao.address, 0);

    const debtTokenAddress = await lockZap.getVDebtToken(weth.address);
    const vdWETH = <VariableDebtToken>(
      await ethers.getContractAt("VariableDebtToken", debtTokenAddress)
    );
    await vdWETH
      .connect(dao)
      .approveDelegation(lockZap.address, ethers.constants.MaxUint256);
  });

  it("2-token zap, with borrow", async function () {
    let lockInfo = await lpFeeDistribution.lockedBalances(dao.address);
    expect(lockInfo.lockData.length).to.be.equal(0);

    const rdntZapAmt = ethers.utils.parseEther("100");
    const wethAmt = await lockZap.quoteFromToken(rdntZapAmt);

    await rdntToken.connect(dao).approve(
      lockZap.address,
      ethers.constants.MaxUint256
    );

    await lockZap.connect(dao).zap(
      true,
      wethAmt,
      rdntZapAmt,
      0,
    )
    // zapDualTokens(true, wethAmt, rdntZapAmt);

    lockInfo = await lpFeeDistribution.lockedBalances(dao.address);
    expect(lockInfo.lockData.length).to.be.equal(1);
  });

  it("2-token zap, no borrow", async function () {
    let lockInfo = await lpFeeDistribution.lockedBalances(dao.address);
    expect(lockInfo.lockData.length).to.be.equal(0);

    const rdntZapAmt = ethers.utils.parseEther("100");
    const ethAmt = await lockZap.quoteFromToken(rdntZapAmt);

    await rdntToken.connect(dao).approve(
      lockZap.address,
      ethers.constants.MaxUint256
    );

    await lockZap.connect(dao).zap(
      false,
      0,
      rdntZapAmt,
      0,
      {
        value: ethAmt
      }
    )
    lockInfo = await lpFeeDistribution.lockedBalances(dao.address);
    expect(lockInfo.lockData.length).to.be.equal(1);
  });
});
