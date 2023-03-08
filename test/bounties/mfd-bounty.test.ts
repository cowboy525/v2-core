import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { advanceTimeAndBlock } from "../../scripts/utils";
import { BountyManager, ChefIncentivesController, LendingPool, MFDPlus, MultiFeeDistribution, ERC20, Leverager, WETH, VariableDebtToken, WETHGateway } from "../../typechain-types";
import _ from "lodash";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { DeployData } from "../../scripts/deploy/types";
import { EligibilityDataProvider } from "../../typechain-types/contracts/eligibility";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deposit, doBorrow, zap } from "./helpers";
import { setupTest } from "../setup";

chai.use(solidity);
const { expect } = chai;

let multiFeeDistribution: MultiFeeDistribution;
let eligibilityProvider: EligibilityDataProvider;
let lpFeeDistribution: MFDPlus;
let lendingPool: LendingPool;
let chefIncentivesController: ChefIncentivesController;
let leverager: Leverager;
let weth: WETH;
let vdWETH: VariableDebtToken;
let wethGateway: WETHGateway;
let deployData: DeployData;
let user1: SignerWithAddress;
let user2: SignerWithAddress;
let hunter: SignerWithAddress;
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
    depositAmt: number,
    defaultLockTime: number
}[] = [];

for (let i = 0; i < relockOptions.length; i++) {
    for (let j = 0; j < borrowOptions.length; j++) {
        for (let k = 0; k < defaultLockTimeOptions.length; k++) {
            for (let m = 0; m < depositOptions.length; m++) {
                const relock = relockOptions[i];
                const borrow = borrowOptions[i];
                const defaultLockTime = defaultLockTimeOptions[k];
                const depositAmt = depositOptions[m];
                runs.push({ relock, borrow, depositAmt, defaultLockTime });
            }
        }
    }
}

const generatePlatformRevenue = async (duration: number = SKIP_DURATION) => {
    await deposit("rWETH", "1000", deployer, lendingPool, deployData);
    await deposit("rUSDT", "10000", deployer, lendingPool, deployData);
    await deposit("rWBTC", "20", deployer, lendingPool, deployData);
    await deposit("rUSDC", "10000", deployer, lendingPool, deployData);

    await doBorrow("rWETH", "10", deployer, lendingPool, deployData);
    await doBorrow("rUSDT", "1000", deployer, lendingPool, deployData);
    await doBorrow("rUSDC", "1000", deployer, lendingPool, deployData);
    await doBorrow("rWBTC", "1", deployer, lendingPool, deployData);

    await advanceTimeAndBlock(duration);

    await doBorrow("rWETH", "10", deployer, lendingPool, deployData);
    await doBorrow("rUSDT", "1000", deployer, lendingPool, deployData);
    await doBorrow("rUSDC", "1000", deployer, lendingPool, deployData);
    await doBorrow("rWBTC", "1", deployer, lendingPool, deployData);

    await lpFeeDistribution.connect(deployer).getAllRewards();
    await advanceTimeAndBlock(duration);
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
        deployData,
        chefIncentivesController,
        leverager,
        weth,
        wethGateway,
        LOCK_DURATION,
        bountyManager,
        user1,
        user2,
        deployer
    } = await setupTest())
    hunter = user2;
    DEFAULT_LOCK_TIME = LOCK_DURATION;
    SKIP_DURATION = DEFAULT_LOCK_TIME / 20;
    lpToken = await ethers.getContractAt("ERC20", deployData.stakingToken);
    // Deposit assets 
    await deposit("rWETH", "10000", deployer, lendingPool, deployData);

    await zapAndDeposit(run.relock, run.borrow, 0, run.depositAmt);
}

// DEV: limit to 1 case
runs = [
    {
        borrow: true,
        depositAmt: eligibleAmt,
        relock: false,
        defaultLockTime: 0
    }
]
runs.forEach(function (run) {

    const {
        relock,
        borrow,
        depositAmt,
        defaultLockTime
    } = run;

    describe(`RL: ${relock} | BOR: ${borrow} | DEP: ${depositAmt} | LockTime: ${defaultLockTime}`, async () => {

        describe("Zap", async () => {
            before(async () => {
                await loadZappedUserFixture(run);
            });

            it("earns platform revenue", async () => {
                await generatePlatformRevenue();
                const pending1 = await lpFeeDistribution.claimableRewards(user1.address);
                const pendingWeth = pending1.filter(entry => entry.token === deployData.allTokens['rWETH'])[0].amount;
                expect(pendingWeth).gt(0);
            });
        });

        describe("MFD", async () => {
            describe("Time DQ:", async () => {

                before(async () => {
                    await loadZappedUserFixture(run);
                });

                it('bounty quote', async () => {
                    await generatePlatformRevenue();
                    await advanceTimeAndBlock(DEFAULT_LOCK_TIME * 2);

                    await lpFeeDistribution.connect(user1).setAutocompound(false);

                    const quote = await bountyManager.connect(hunter).quote(user1.address);

                    const bb = await bountyManager.getBaseBounty();
                    if (relock) {
                        expect(quote.bounty).equals(bb);
                    } else {
                        expect(quote.bounty).gt(0);
                        expect(quote.bounty).not.equals(bb);
                    }
                });

                it('bounty quote + claim', async () => {
                    // Hunter gets bounty in MFD
                    // Inelig plat rev is removed from Lpfd
                    // No earnings in case empty

                    const quote = await bountyManager.connect(hunter).quote(user1.address);
                    const bounties = await lpFeeDistribution.bountyForUser(user1.address);
                    const rTokenAmounts0 = [];
                    for (let i = 0; i < bounties.length; i += 1) {
                        const rToken = await ethers.getContractAt("ERC20", bounties[i].token);
                        const balance = await rToken.balanceOf(lpFeeDistribution.address);
                        rTokenAmounts0.push(balance);
                    }

                    const earned0 = (await multiFeeDistribution.earnedBalances(hunter.address)).total;

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

                    await bountyManager.connect(hunter).claim(user1.address, quote.bounty, 1);
                    const earned1 = (await multiFeeDistribution.earnedBalances(hunter.address)).total;
                    expect(earned1.sub(earned0)).to.be.equal(quote.bounty);

                    for (let i = 0; i < bounties.length; i += 1) {
                        const rToken = await ethers.getContractAt("ERC20", bounties[i].token);
                        const balance1 = await rToken.balanceOf(lpFeeDistribution.address);
                        if (rTokenAmounts0[0].gt(0)) {
                            expect(bounties[i].amount.toNumber()).to.be.approximately(rTokenAmounts0[i].sub(balance1).toNumber(), 1000);
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

            describe("New Lock DQ emissions:", async () => {
                before(async () => {
                    await zapAndDeposit(run.relock, run.borrow, 0, run.depositAmt);
                });

                it('bounty quote + claim', async () => {
                    // Hunter gets bounty in MFD
                    // Inelig plat rev is removed from Lpfd
                    await generatePlatformRevenue();
                    await advanceTimeAndBlock(DEFAULT_LOCK_TIME * 2);

                    const quote = await bountyManager.connect(hunter).quote(user1.address);
                    const bounties = await lpFeeDistribution.bountyForUser(user1.address);
                    const rTokenAmounts0 = [];
                    for (let i = 0; i < bounties.length; i += 1) {
                        const rToken = await ethers.getContractAt("ERC20", bounties[i].token);
                        const balance = await rToken.balanceOf(lpFeeDistribution.address);
                        rTokenAmounts0.push(balance);
                    }

                    const earned0 = (await multiFeeDistribution.earnedBalances(hunter.address)).total;

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

                    await bountyManager.connect(hunter).claim(user1.address, quote.bounty, 1);
                    const earned1 = (await multiFeeDistribution.earnedBalances(hunter.address)).total;
                    expect(earned1.sub(earned0)).to.be.equal(quote.bounty);

                    for (let i = 0; i < bounties.length; i += 1) {
                        const rToken = await ethers.getContractAt("ERC20", bounties[i].token);
                        const balance1 = await rToken.balanceOf(lpFeeDistribution.address);
                        if (rTokenAmounts0[0].gt(0)) {
                            expect(bounties[i].amount.toNumber()).to.be.approximately(rTokenAmounts0[i].sub(balance1).toNumber(), 1000);
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
        });
    });
})
