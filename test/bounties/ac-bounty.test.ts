import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { advanceTimeAndBlock } from "../../scripts/utils";
import { BountyManager, LendingPool, MFDPlus, MultiFeeDistribution, ERC20, VariableDebtToken, Leverager, WETH, WETHGateway, AutoCompounder } from "../../typechain-types";
import _ from "lodash";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { DeployData } from "../../scripts/deploy/types";
import { EligibilityDataProvider } from "../../typechain-types/contracts/eligibility";
import { PriceProvider } from "../../typechain-types/contracts/oracles";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber } from "ethers";
import { HOUR } from "../../config/constants";
import { deposit, doBorrow, toNum, zap } from "./helpers";
import { setupTest } from "../setup";

chai.use(solidity);
const { expect } = chai;

let multiFeeDistribution: MultiFeeDistribution;
let eligibilityProvider: EligibilityDataProvider;
let lpFeeDistribution: MultiFeeDistribution;
let autoCompounder: AutoCompounder;
let lendingPool: LendingPool;
let leverager: Leverager;
let wethGateway: WETHGateway;
let weth: WETH;
let priceProvider: PriceProvider;
let deployData: DeployData;
let user1: SignerWithAddress;
let user2: SignerWithAddress;
let hunter: SignerWithAddress;
let vdWETH: VariableDebtToken;
let deployer: SignerWithAddress;
let DEFAULT_LOCK_TIME: number;
let LOCK_DURATION: number;
let SKIP_DURATION: number;
let bountyManager: BountyManager;
let lpToken: ERC20;

const eligibleAmt = 1000000;

const generatePlatformRevenue = async (duration: number = SKIP_DURATION) => {
    await deposit("rWETH", "20000", deployer, lendingPool, deployData);

    await doBorrow("rWETH", "10000", deployer, lendingPool, deployData);

    await advanceTimeAndBlock(duration);

    await doBorrow("rWETH", "1", deployer, lendingPool, deployData);

    await lpFeeDistribution.connect(deployer).getAllRewards();
    await advanceTimeAndBlock(duration);
}

const zapAndDeposit = async (defaultLockTime: number, depositAmt: number) => {

    // await lpFeeDistribution.connect(user1).setRelock(relock);
    await lpFeeDistribution.connect(user1).setDefaultRelockTypeIndex(defaultLockTime);
    await deposit("rUSDC", depositAmt.toString(), user1, lendingPool, deployData);
    await zap(user1, deployData, true, defaultLockTime);

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

const loadZappedUserFixture = async () => {
    ({
        multiFeeDistribution,
        eligibilityProvider,
        lpFeeDistribution,
        lendingPool,
        leverager,
        weth,
        wethGateway,
        priceProvider,
        deployData,
        LOCK_DURATION,
        autoCompounder,
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
    await zapAndDeposit(0, eligibleAmt);
}

const makeHunterEligible = async () => {
    const minDLPBalance = await bountyManager.minDLPBalance();
    await lpToken.approve(lpFeeDistribution.address, minDLPBalance)
    await lpFeeDistribution.stake(minDLPBalance, hunter.address, 0);
    await deposit("rUSDC", "10", hunter, lendingPool, deployData);
}

const getPendingInRdnt = async (): Promise<number> => {
    const rdntPriceInEth = parseFloat(ethers.utils.formatUnits(await priceProvider.getTokenPrice(), 8));
    const pending1 = await lpFeeDistribution.claimableRewards(user1.address);
    const pendingWeth = pending1.filter(entry => entry.token === deployData.allTokens['rWETH'])[0].amount;
    const pendingInRdnt = parseFloat(ethers.utils.formatEther(pendingWeth)) / rdntPriceInEth;
    const acFee = .03;
    const hunterShare = .5;
    const expectedFee = pendingInRdnt * acFee * hunterShare;
    return expectedFee;
}

describe(`AutoCompound:`, async () => {
    let pendingWeth: BigNumber;

    before(async () => {
        await loadZappedUserFixture();
        await makeHunterEligible();
        await lpFeeDistribution.connect(user1).setAutocompound(true);
    });

    it("no bounty when no platform rev", async () => {
        const quote = await bountyManager.connect(hunter).quote(user1.address);
        // let quote = await bountyManager.connect(hunter).executeBounty(user1.address, false, 0);
        expect(toNum(quote.bounty)).equals(0);
    });

    it("earns platform revenue", async () => {
        await generatePlatformRevenue();
        const pending1 = await lpFeeDistribution.claimableRewards(user1.address);
        pendingWeth = pending1.filter(entry => entry.token === deployData.allTokens['rWETH'])[0].amount;
        expect(pendingWeth).gt(0);
    });

    it("has bounty quote when over autocompound threshold", async () => {
        const quote = await bountyManager.connect(hunter).quote(user1.address);
        const expectedFee = await getPendingInRdnt();
        expect(parseFloat(ethers.utils.formatEther((quote.bounty)))).closeTo(expectedFee, .5);
    });

    it("can claim bounty", async () => {
        const lockInfo0 = await lpFeeDistribution.lockedBalances(user1.address);
        expect(lockInfo0.lockData.length).to.be.equal(1);

        const expectedFee = await getPendingInRdnt();
        const quote = await bountyManager.connect(hunter).quote(user1.address);

        await bountyManager.connect(hunter).claim(user1.address, quote.actionType);

        const bountyReceived = toNum((await multiFeeDistribution.earnedBalances(hunter.address)).total);
        expect(bountyReceived).closeTo(expectedFee, .5);

        const lockInfo1 = await lpFeeDistribution.lockedBalances(user1.address);
        expect(lockInfo1.lockData.length).to.be.equal(2);
    });

    it("quote goes to zero after claim, is 0 until re-elig", async () => {
        const quote = await bountyManager.quote(user1.address);
        expect(quote.bounty).equals(0);
    });

    it("quote still 0 w/ rev, but !wait 24 hours", async () => {
        await generatePlatformRevenue(1 * HOUR);
        const quote = await bountyManager.quote(user1.address);
        expect(toNum(quote.bounty)).equals(0);
    });

    it("quote > 0 after 24 hours pass", async () => {
        await advanceTimeAndBlock(24 * HOUR);
        await generatePlatformRevenue();
        const expectedFee = await getPendingInRdnt();
        const quote = await bountyManager.quote(user1.address);
        expect(toNum(quote.bounty)).closeTo(expectedFee, 50);
    });

    it("cant AC user who has not enabled", async () => {
        await lpFeeDistribution.connect(user1).setAutocompound(false);
        await expect(
            bountyManager.connect(hunter).claim(user1.address, 1, 3)
        ).to.be.reverted;
        await lpFeeDistribution.connect(user1).setAutocompound(true);
    });

    it("can autocompound self for no Fee", async () => {
        await generatePlatformRevenue(1 * HOUR);
        let fee = await autoCompounder.connect(user1).selfCompound();
        await expect(fee.value).to.be.equal(0);
    });
});
