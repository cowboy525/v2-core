import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import assert from 'assert';
import {ethers} from 'hardhat';
import {advanceTimeAndBlock} from '../../scripts/utils';
import {
	ChefIncentivesController,
	LendingPool,
	MultiFeeDistribution,
	MockERC20,
	MockToken,
	PriceProvider,
	RadiantOFT,
	EligibilityDataProvider,
} from '../../typechain';
import _ from 'lodash';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
import {BigNumber} from 'ethers';
import {DeployConfig, DeployData} from '../../scripts/deploy/types';
import {getRdntBal, zapIntoEligibility} from '../shared/helpers';
import {setupTest} from '../setup';
import {loadFixture} from '@nomicfoundation/hardhat-network-helpers';
chai.use(solidity);
const {expect} = chai;

describe('Require Locked Value', () => {
	let deployer: SignerWithAddress;
	let dao: SignerWithAddress;
	let user2: SignerWithAddress;
	let user3: SignerWithAddress;

	let USDC: MockToken;
	let LPToken: MockToken;

	let rUSDC: MockERC20;
	let lendingPool: LendingPool;
	let chef: ChefIncentivesController;
	let multiFeeDistribution: MultiFeeDistribution;
	let radiantToken: RadiantOFT;
	let eligibilityDataProvider: EligibilityDataProvider;
	let priceProvider: PriceProvider;

	// let duration = REWARDS_DURATION * 40;
	let duration = 0;
	let ETH_LIQUIDITY = BigNumber.from(0);
	let RDNT_LIQUDITY = BigNumber.from(0);
	let usdcAddress = '';

	const usdcPerAccount = ethers.utils.parseUnits('10000', 6);
	const borrowAmt = ethers.utils.parseUnits('1000', 6);

	let deployData: DeployData;
	let deployConfig: DeployConfig;

	before(async () => {
		const fixture = await setupTest();

		deployData = fixture.deployData;
		deployConfig = fixture.deployConfig;

		deployer = fixture.deployer;
		dao = fixture.dao;
		user2 = fixture.user2;
		user3 = fixture.user3;

		(ETH_LIQUIDITY = deployConfig.LP_INIT_ETH), 18;
		(RDNT_LIQUDITY = deployConfig.LP_INIT_RDNT), 18;

		USDC = fixture.usdc;
		usdcAddress = USDC.address;
		rUSDC = <MockERC20>await ethers.getContractAt('mockERC20', deployData.allTokens.rUSDC);

		LPToken = <MockToken>await ethers.getContractAt('MockToken', deployData.stakingToken);

		lendingPool = fixture.lendingPool;
		chef = fixture.chefIncentivesController;
		multiFeeDistribution = fixture.multiFeeDistribution;
		radiantToken = fixture.rdntToken;
		eligibilityDataProvider = fixture.eligibilityProvider;
		priceProvider = fixture.priceProvider;

		duration = deployConfig.MFD_VEST_DURATION;
	});

	it('Deposit and borrow by User 2 + 3', async () => {
		// Mint
		await USDC.mint(user2.address, usdcPerAccount);
		await USDC.mint(user3.address, usdcPerAccount);

		// Approve
		await USDC.connect(user2).approve(lendingPool.address, ethers.constants.MaxUint256);
		await radiantToken.connect(user2).approve(multiFeeDistribution.address, ethers.constants.MaxUint256);
		await USDC.connect(user3).approve(lendingPool.address, ethers.constants.MaxUint256);
		await radiantToken.connect(user3).approve(multiFeeDistribution.address, ethers.constants.MaxUint256);

		// Deposit and Borrow
		await lendingPool.connect(user2).deposit(usdcAddress, usdcPerAccount, user2.address, 0);

		await lendingPool.connect(user3).deposit(usdcAddress, usdcPerAccount, user3.address, 0);

		await lendingPool.connect(user3).borrow(usdcAddress, borrowAmt, 2, 0, user3.address);

		const bal = Number(await rUSDC.balanceOf(user2.address));
		assert.notEqual(bal, 0, `Has balance`);

		// Check user3's TVL and required locked balanace
		const data = await lendingPool.getUserAccountData(user3.address);
		const required = await eligibilityDataProvider.requiredUsdValue(user3.address);
		const ratio = await eligibilityDataProvider.requiredDepositRatio();
		expect(data.totalCollateralETH.mul(ratio).div(1e4)).to.be.equal(required);

		expect(await eligibilityDataProvider.isEligibleForRewards(user2.address)).to.be.equal(false);
	});

	it('Lock new tokens, locked eth values are correct', async () => {
		const lpBalance = await LPToken.balanceOf(deployer.address);
		await LPToken.transfer(user2.address, lpBalance);
		await LPToken.connect(user2).approve(multiFeeDistribution.address, ethers.constants.MaxUint256);
		const lockedVaule0 = await eligibilityDataProvider.lockedUsdValue(user2.address);
		expect(lockedVaule0).to.be.equal(0);

		await multiFeeDistribution.connect(user2).stake(lpBalance, user2.address, 0);

		const lockedVaule1 = await eligibilityDataProvider.lockedUsdValue(user2.address);

		const lpTokenPriceUsd = await priceProvider.getLpTokenPriceUsd();
		const expectedLockedUsdVal = lpTokenPriceUsd.mul(lpBalance).div(ethers.utils.parseUnits('1', 18));

		expect(lockedVaule1).to.be.equal(expectedLockedUsdVal);

		// For test purpose, lockedValue should exceed required
		const required = await eligibilityDataProvider.requiredUsdValue(user2.address);
		expect(lockedVaule1).to.be.gt(required);
		expect(await eligibilityDataProvider.isEligibleForRewards(user2.address)).to.be.equal(true);
	});

	it('Earns RDNT on Lend/Borrow', async () => {
		await advanceTimeAndBlock(duration / 10);
		expect(await eligibilityDataProvider.isEligibleForRewards(user2.address)).to.be.equal(true);
		const vestableRdnt = await chef.pendingRewards(user2.address, deployData.allTokenAddrs);
		const balances = _.without(
			vestableRdnt.map((bn) => Number(bn)),
			0
		);
		assert.equal(balances.length, 1, `Earned Rewards`);
	});

	it('Unlock all, earnings go to zero; but prev emissions are kept', async () => {
		const rewards0 = await chef.pendingRewards(user2.address, deployData.allTokenAddrs);
		const userBaseClaimable0 = await chef.userBaseClaimable(user2.address);

		await advanceTimeAndBlock(duration);
		await multiFeeDistribution.connect(user2).setRelock(false);
		await multiFeeDistribution.connect(user2).withdrawExpiredLocksForWithOptions(user2.address, 0, false);

		const lockedVaule0 = await eligibilityDataProvider.lockedUsdValue(user2.address);
		expect(lockedVaule0).to.be.equal(0);

		const rewards1 = await chef.pendingRewards(user2.address, deployData.allTokenAddrs);
		for (let i = 0; i < rewards1.length; i += 1) {
			expect(rewards1[i]).to.be.equal(0);
		}
		const userBaseClaimable1 = await chef.userBaseClaimable(user2.address);
		const totalRewards0 = userBaseClaimable0.add(rewards0.reduce((a, b) => a.add(b)));

		expect(userBaseClaimable1).to.be.gte(totalRewards0);
	});

	it('Lock again, locked eth values are correct', async () => {
		const lockedVaule0 = await eligibilityDataProvider.lockedUsdValue(user2.address);
		expect(lockedVaule0).to.be.equal(0);

		await zapIntoEligibility(user2, deployData);

		const lockedVaule2 = await eligibilityDataProvider.lockedUsdValue(user2.address);

		// For test purpose, lockedValue should exceed required
		const required = await eligibilityDataProvider.requiredUsdValue(user2.address);
		expect(lockedVaule2).to.be.gt(required);
	});

	it('Earns RDNT on Lend/Borrow', async () => {
		await lendingPool.connect(user3).borrow(usdcAddress, borrowAmt, 2, 0, user3.address);
		await advanceTimeAndBlock(duration / 10);
		const vestableRdnt = await chef.pendingRewards(user2.address, deployData.allTokenAddrs);
		const balances = _.without(
			vestableRdnt.map((bn) => Number(bn)),
			0
		);
		assert.equal(balances.length, 1, `Earned Rewards`);
	});

	it('User2 can Vest RDNT', async () => {
		await chef.claim(user2.address, deployData.allTokenAddrs);
		await advanceTimeAndBlock(duration);

		const {amount: mfdRewardAmount, penaltyAmount: penalty0} = await multiFeeDistribution.withdrawableBalance(
			user2.address
		);
		assert.notEqual(mfdRewardAmount, 0, `Can exit w/ rdnt`);
		assert.equal(penalty0, 0, `no penalty`);
	});

	it('Can exit and get RDNT', async () => {
		await radiantToken.connect(user2).transfer(dao.address, await radiantToken.balanceOf(user2.address));

		await multiFeeDistribution.connect(user2).exit(true);
		const bal0 = await getRdntBal(radiantToken, user2);
		assert.equal(bal0.gt(0), true, `Got RDNT on exit`);
	});
});
