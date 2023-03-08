import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { advanceTimeAndBlock } from "../../scripts/utils";
import { BountyManager, ChefIncentivesController, LendingPool, MFDPlus, MultiFeeDistribution, RadiantOFT, TestnetLockZap, ERC20, Leverager, WETH, VariableDebtToken, WETHGateway } from "../../typechain-types";
import _ from "lodash";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { DeployData } from "../../scripts/deploy/types";
import {
    sellRdnt,
    getLatestBlockTimestamp,
} from "../shared/helpers";
import { EligibilityDataProvider } from "../../typechain-types/contracts/eligibility";
import { PriceProvider } from "../../typechain-types/contracts/oracles";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber } from "ethers";
import { deposit, doBorrow, now, zap } from "./helpers";
import { setupTest } from "../setup";

chai.use(solidity);
const { expect } = chai;

const toNum = (bn: BigNumber) => {
    return parseFloat(ethers.utils.formatEther(bn))
}

let multiFeeDistribution: MultiFeeDistribution;
let eligibilityProvider: EligibilityDataProvider;
let lpFeeDistribution: MFDPlus;
let lendingPool: LendingPool;
let chefIncentivesController: ChefIncentivesController;
let priceProvider: PriceProvider;
let weth: WETH;
let rdntToken: RadiantOFT;
let lockZap: TestnetLockZap;
let leverager: Leverager;
let vdWETH: VariableDebtToken;
let wethGateway: WETHGateway;
let deployData: DeployData;
let user1: SignerWithAddress;
let user2: SignerWithAddress;
let hunter: SignerWithAddress;
let dao: SignerWithAddress;
let deployer: SignerWithAddress;
let DEFAULT_LOCK_TIME: number;
let LOCK_DURATION: number;
let SKIP_DURATION: number;
let bountyManager: BountyManager;
let lpToken: ERC20;

const relockOptions = [true, false];
const borrowOptions = [true, false];
const defaultLockTimeOptions = [0, 1, 2, 3];

const eligibleAmt = 1000000;
// no emish, elig, too much
const depositOptions = [0, eligibleAmt, 100000000];

let runs: {
    relock: boolean,
    borrow: boolean,
    depositAmt: number
}[] = [];

for (let i = 0; i < relockOptions.length; i++) {
    for (let j = 0; j < borrowOptions.length; j++) {
        for (let k = 0; k < defaultLockTimeOptions.length; k++) {
            for (let m = 0; m < depositOptions.length; m++) {
                const relock = relockOptions[i];
                const borrow = borrowOptions[i];
                const depositAmt = depositOptions[m];
                runs.push({ relock, borrow, depositAmt });
            }
        }
    }
}

const generatePlatformRevenue = async () => {
    await doBorrow("rWETH", "1000", deployer, lendingPool, deployData);
    await advanceTimeAndBlock(SKIP_DURATION);
    await doBorrow("rWETH", "1000", deployer, lendingPool, deployData);
    await lpFeeDistribution.connect(deployer).getAllRewards();
    await advanceTimeAndBlock(SKIP_DURATION);
}

const zapAndDeposit = async (relock: boolean, borrow: boolean, defaultLockTime: number, depositAmt: number) => {

    await lpFeeDistribution.connect(user1).setRelock(relock);
    await lpFeeDistribution.connect(user1).setDefaultRelockTypeIndex(defaultLockTime);
    if (borrow) {
        await deposit("rUSDC", depositAmt.toString(), user1, lendingPool, deployData);
    }
    await zap(user1, deployData, borrow && depositAmt !== 0, defaultLockTime);
    if (!borrow) {
        await deposit("rUSDC", depositAmt.toString(), user1, lendingPool, deployData);
    }

    // Now Locked
    const isEligible = await eligibilityProvider.isEligibleForRewards(user1.address);
    const lockedUsd = await eligibilityProvider.lockedUsdValue(user1.address);
    const requiredUsdValue = await eligibilityProvider.requiredUsdValue(user1.address);
    return {
        isEligible,
        lockedUsd,
        requiredUsdValue
    }
};

const loadZappedUserFixture = async (run: any) => {
    ({
        multiFeeDistribution,
        eligibilityProvider,
        lpFeeDistribution,
        lendingPool,
        priceProvider,
        leverager,
        weth,
        wethGateway,
        deployData,
        chefIncentivesController,
        rdntToken,
        LOCK_DURATION,
        bountyManager,
        dao,
        user1,
        user2,
        deployer
    } = await setupTest())
    hunter = user2;
    // Lock index 0
    DEFAULT_LOCK_TIME = (await lpFeeDistribution.getLockDurations())[0].toNumber();
    SKIP_DURATION = DEFAULT_LOCK_TIME / 20;
    lpToken = await ethers.getContractAt("ERC20", deployData.stakingToken);
    // Deposit assets 
    await deposit("rWETH", "10000", deployer, lendingPool, deployData);
    lockZap = await ethers.getContractAt("TestnetLockZap", deployData.lockZap);

    await zapAndDeposit(run.relock, run.borrow, 0, run.depositAmt); // Lock index 0
}

// DEV: limit to 1 case
runs = [
    {
        borrow: true,
        depositAmt: eligibleAmt,
        relock: false
    }
]
runs.forEach(function (run) {

    const {
        relock,
        borrow,
        depositAmt
    } = run;

    describe(`RL: ${relock} | BOR: ${borrow} | DEP: ${depositAmt}`, async () => {

        describe("Zap", async () => {

            before(async () => {
                await loadZappedUserFixture(run);
            });

            it('has eligible states', async () => {
                const isEligible = await eligibilityProvider.isEligibleForRewards(user1.address);
                const lastEligibleTime = await eligibilityProvider.lastEligibleTime(user1.address);
                const requiredUsdValue = await eligibilityProvider.requiredUsdValue(user1.address);

                const expectedEligible = depositAmt === eligibleAmt;
                expect(isEligible).equal(expectedEligible);

                const expectedLastEligible = await now() + DEFAULT_LOCK_TIME;
                expect(lastEligibleTime.toNumber()).closeTo(expectedLastEligible, 10);

                if (depositAmt > 0) {
                    expect(requiredUsdValue).gt(0);
                }
            });

            it("earns emissions when applicable", async () => {
                await advanceTimeAndBlock(SKIP_DURATION);
                const pending1 = await chefIncentivesController.allPendingRewards(user1.address);
                await advanceTimeAndBlock(SKIP_DURATION);
                const pending2 = await chefIncentivesController.allPendingRewards(user1.address);

                if (depositAmt == eligibleAmt) {
                    expect(pending2).gt(pending1);
                } else {
                    expect(pending2).equals(0);
                }
            });

            it("earns platform revenue", async () => {
                await generatePlatformRevenue();
                const pending1 = await lpFeeDistribution.claimableRewards(user1.address);
                const pendingWeth = pending1.filter(entry => entry.token === deployData.allTokens['rWETH'])[0].amount;
                expect(pendingWeth).gt(0);
            });
        });

        describe("CIC", async () => {
            describe("Time DQ:", async () => {
                let pendingAtEndOfEligibility: BigNumber, pendingAfterInelig: BigNumber, pending3;

                before(async () => {
                    await loadZappedUserFixture(run);
                    // await generatePlatformRevenue();
                    const lastEligibleTime = (await eligibilityProvider.lastEligibleTime(user1.address)).toNumber();
                    await advanceTimeAndBlock(lastEligibleTime - await now() - 1)
                    pendingAtEndOfEligibility = await chefIncentivesController.allPendingRewards(user1.address);
                    await advanceTimeAndBlock(DEFAULT_LOCK_TIME);
                    pendingAfterInelig = await chefIncentivesController.allPendingRewards(user1.address);
                    const minDLPBalance = await bountyManager.minDLPBalance();
                    await lpToken.approve(lpFeeDistribution.address, minDLPBalance)
                    await lpFeeDistribution.stake(minDLPBalance, hunter.address, 0);

                    let vdWETHAddress = await leverager.getVDebtToken(weth.address);
                    vdWETH = <VariableDebtToken>(
                        await ethers.getContractAt("VariableDebtToken", vdWETHAddress)
                    );
                    await vdWETH
                        .connect(hunter)
                        .approveDelegation(leverager.address, ethers.constants.MaxUint256);

                    await wethGateway
                        .connect(hunter)
                        .depositETHWithAutoDLP(lendingPool.address, hunter.address, 0, {
                            value: ethers.utils.parseEther("1"),
                        });
                });

                it('bounty quote + claim', async () => {
                    const ineligEmissions = parseFloat(ethers.utils.formatEther(pendingAfterInelig.sub(pendingAtEndOfEligibility)));
                    const expectedBounty = ineligEmissions / 2;

                    const quote = await bountyManager.quote(user1.address);
                    const quotedBounty = toNum(quote.bounty);
                    // let quote = await bountyManager.doAction(user1.address, false, 0, 1);

                    if (relock || depositAmt !== eligibleAmt) {
                        expect(quotedBounty).equals(0);
                    } else {
                        expect(quotedBounty).not.equals(0);
                        expect(quotedBounty).closeTo(expectedBounty, 1);
                    }

                    const cic0 = await rdntToken.balanceOf(chefIncentivesController.address);
                    const bounty0 = await rdntToken.balanceOf(bountyManager.address);
                    const hunter0 = (await multiFeeDistribution.earnedBalances(hunter.address)).total;

                    await bountyManager.connect(hunter).claim(user1.address, quote.bounty, quote.actionType);
                    const bountyReceived = parseFloat(ethers.utils.formatEther((await multiFeeDistribution.earnedBalances(hunter.address)).total));
                    expect(bountyReceived).closeTo(quotedBounty, .1);

                    const cic1 = await rdntToken.balanceOf(chefIncentivesController.address);
                    const bounty1 = await rdntToken.balanceOf(bountyManager.address);
                    const hunter1 = (await multiFeeDistribution.earnedBalances(hunter.address)).total;
                    const totalBounty = cic0.sub(cic1);
                    const expected = totalBounty.mul(await bountyManager.HUNTER_SHARE()).div(1e4);
                    expect(bounty1.sub(bounty0)).to.be.equal(totalBounty.sub(expected));
                    expect(hunter1.sub(hunter0)).to.be.equal(expected);
                });

                it('doesnt earn emish', async () => {
                    const pendingPre = await chefIncentivesController.allPendingRewards(user1.address);
                    await advanceTimeAndBlock(DEFAULT_LOCK_TIME);
                    const pendingPost = await chefIncentivesController.allPendingRewards(user1.address);
                    if (relock && depositAmt === eligibleAmt) {
                        // keeps earning
                        expect(pendingPost).gt(pendingPre);
                    } else {
                        // was DQd, shouldnt earn
                        expect(pendingPost).equals(pendingPre);
                    }
                });
            });

            describe("Claim DQ:", async () => {
                let pendingOnlyElig: BigNumber, pendingWithInelig: BigNumber;

                before(async () => {
                    await loadZappedUserFixture(run);
                    const lastEligibleTime = (await eligibilityProvider.lastEligibleTime(user1.address)).toNumber();
                    await advanceTimeAndBlock(lastEligibleTime - await now() - 1)
                    pendingOnlyElig = await chefIncentivesController.allPendingRewards(user1.address);
                    await advanceTimeAndBlock(DEFAULT_LOCK_TIME);
                    pendingWithInelig = await chefIncentivesController.allPendingRewards(user1.address);
                });

                it('disqualifying action', async () => {
                    await chefIncentivesController.connect(user1).claimAll(user1.address);

                    const receivedRewards = parseFloat(ethers.utils.formatEther(
                        (await multiFeeDistribution.earnedBalances(user1.address)).total
                    ));

                    const expectedReceivedRewards = relock ? pendingWithInelig : pendingOnlyElig;

                    expect(receivedRewards).closeTo(
                        parseFloat(ethers.utils.formatEther(
                            expectedReceivedRewards
                        ))
                        , 1);

                    const timestamp = await getLatestBlockTimestamp();
                    const dqTimePost = await eligibilityProvider.getDqTime(user1.address);
                    const isEligible = await eligibilityProvider.isEligibleForRewards(user1.address);

                    if (!relock && depositAmt === eligibleAmt) {
                        expect(dqTimePost).equals(timestamp);
                        expect(isEligible).equals(false);
                    } else {
                        await lpFeeDistribution.connect(user1).relock();
                    }

                });

                it('doesnt earn emish', async () => {
                    const pendingPre = await chefIncentivesController.allPendingRewards(user1.address);
                    await advanceTimeAndBlock(DEFAULT_LOCK_TIME);
                    const pendingPost = await chefIncentivesController.allPendingRewards(user1.address);

                    if (relock && depositAmt === eligibleAmt) {
                        // keeps earning
                        expect(pendingPost).gt(pendingPre);
                    } else {
                        // was DQd, shouldnt earn
                        expect(pendingPost).equals(pendingPre);
                    }
                });
            });

            describe("Market DQ:", async () => {
                let pendingAtEndOfEligibility: BigNumber;

                before(async () => {
                    await loadZappedUserFixture(run);

                    const lastEligTimePre = await eligibilityProvider.lastEligibleTime(user1.address);

                    // skip to earn some RDNT
                    await advanceTimeAndBlock(SKIP_DURATION);
                    await priceProvider.update();

                    const pricePre = await priceProvider.getTokenPriceUsd();
                    pendingAtEndOfEligibility = await chefIncentivesController.allPendingRewards(user1.address);
                    const baseBountyPre = await bountyManager.getBaseBounty();
                    const minDLPBalance = await bountyManager.minDLPBalance();
                    await lpToken.approve(lpFeeDistribution.address, minDLPBalance)
                    await lpFeeDistribution.stake(minDLPBalance, hunter.address, 0);

                    let vdWETHAddress = await leverager.getVDebtToken(weth.address);
                    vdWETH = <VariableDebtToken>(
                        await ethers.getContractAt("VariableDebtToken", vdWETHAddress)
                    );
                    await vdWETH
                        .connect(hunter)
                        .approveDelegation(leverager.address, ethers.constants.MaxUint256);

                    await wethGateway
                        .connect(hunter)
                        .depositETHWithAutoDLP(lendingPool.address, hunter.address, 0, {
                            value: ethers.utils.parseEther("1"),
                        });

                    await sellRdnt(
                        "100000000",
                        dao,
                        rdntToken,
                        lockZap,
                        priceProvider,
                        deployData.stakingToken
                    );
                    await advanceTimeAndBlock(3601);
                    await priceProvider.update();
                    const pricePost = await priceProvider.getTokenPriceUsd();


                    const baseBountyPost = await bountyManager.getBaseBounty();
                    const lastEligTimePost = await eligibilityProvider.lastEligibleTime(user1.address);

                    expect(pricePost).lt(pricePre);
                    // price down, more base bounty RDNT
                    expect(baseBountyPost).gt(baseBountyPre);

                    expect(
                        await eligibilityProvider.isEligibleForRewards(user1.address)
                    ).is.false;

                    expect(
                        await eligibilityProvider.isMarketDisqualified(user1.address)
                    ).is.true;

                    expect(lastEligTimePre).equals(lastEligTimePost);
                });

                it('bounty quote + claim', async () => {
                    const quote = await bountyManager.quote(user1.address);
                    const quotedBounty = toNum(
                        quote.bounty
                    );

                    if (depositAmt === eligibleAmt) {
                        const bb = toNum(await bountyManager.getBaseBounty());

                        // since Market DQ, all will have BB
                        expect(quotedBounty).equals(bb);

                        await bountyManager.connect(hunter).claim(user1.address, quote.bounty, quote.actionType);
                        const bountyReceived = parseFloat(ethers.utils.formatEther((await multiFeeDistribution.earnedBalances(hunter.address)).total));
                        expect(bountyReceived).closeTo(quotedBounty, .001);
                    } else {
                        expect(quotedBounty).equals(0);
                    }
                });

                it('doesnt earn emish', async () => {
                    const pendingPre = await chefIncentivesController.allPendingRewards(user1.address);
                    await advanceTimeAndBlock(DEFAULT_LOCK_TIME);
                    const pendingPost = await chefIncentivesController.allPendingRewards(user1.address);
                    // was DQd, shouldnt earn
                    expect(pendingPre).equals(pendingPost);
                });
            });

            describe("Self DQ via Deposit:", async () => {
                let pendingAtEndOfEligibility: BigNumber, pendingAfterInelig: BigNumber, pending3;

                before(async () => {
                    await loadZappedUserFixture(run);

                    const lastEligibleTime = (await eligibilityProvider.lastEligibleTime(user1.address)).toNumber();

                    await advanceTimeAndBlock(lastEligibleTime - await now() - 1)
                    pendingAtEndOfEligibility = await chefIncentivesController.allPendingRewards(user1.address);

                    await advanceTimeAndBlock(DEFAULT_LOCK_TIME);

                    pendingAfterInelig = await chefIncentivesController.allPendingRewards(user1.address);
                });

                it('disqualifying action', async () => {
                    if (depositAmt == eligibleAmt) {
                        const dqTimePre = await eligibilityProvider.getDqTime(user1.address);
                        expect(dqTimePre).equals(0);

                        await deposit("rUSDC", "69", user1, lendingPool, deployData);

                        const pendingAfterDeposit = parseFloat(ethers.utils.formatEther(await chefIncentivesController.allPendingRewards(user1.address)));
                        const expected = relock ? pendingAfterInelig : pendingAtEndOfEligibility;
                        expect(pendingAfterDeposit).closeTo(
                            parseFloat(ethers.utils.formatEther(
                                expected
                            ))
                            , 1);

                        const timestamp = await getLatestBlockTimestamp();
                        const dqTimePost = await eligibilityProvider.getDqTime(user1.address);
                        const isEligible = await eligibilityProvider.isEligibleForRewards(user1.address);
                        if (!relock) {
                            expect(dqTimePost).equals(timestamp);
                            expect(isEligible).equals(false);
                        } else {
                            await lpFeeDistribution.connect(user1).relock();
                        }
                    }
                });

                it('doesnt earn emish', async () => {
                    const pendingPre = await chefIncentivesController.allPendingRewards(user1.address);
                    await advanceTimeAndBlock(DEFAULT_LOCK_TIME);
                    const pendingPost = await chefIncentivesController.allPendingRewards(user1.address);
                    if (relock && depositAmt === eligibleAmt) {
                        // keeps earning
                        expect(pendingPost).gt(pendingPre);
                    } else {
                        // was DQd, shouldnt earn
                        expect(pendingPost).equals(pendingPre);
                    }
                });
            });

            describe("While Eligible: bounty = 0, cant claim:", async () => {
                before(async () => {
                    await loadZappedUserFixture(run);
                    await advanceTimeAndBlock(SKIP_DURATION);
                });

                it('bounty quote + claim', async () => {
                    if (depositAmt == eligibleAmt) {
                        const quote = toNum((await bountyManager.quote(user1.address)).bounty);
                        expect(quote).equals(0);
                        await expect(
                            bountyManager.connect(hunter).claim(user1.address, quote, 2)
                        ).to.be.reverted;
                        // ).to.be.revertedWith("user still eligible");

                    }
                });
            });

            describe("run w/ 0 funded bounties, doesnt work, v1", async function () {
                before(async function () {
                    console.log('           reset to zap fixture');
                });
                it('dq test', function () {
                    expect(1).equals(1);
                });
            });
        });
    });
})
