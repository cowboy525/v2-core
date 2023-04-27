import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {ethers, upgrades} from 'hardhat';
import chai from 'chai';
import {
	ChefIncentivesController,
	LendingPool,
	LiquidityZap,
	MockToken,
	MultiFeeDistribution,
	RadiantOFT,
	EligibilityDataProvider,
	UniswapPoolHelper,
	VariableDebtToken,
	TestnetLockZap,
	WETH,
	PriceProvider,
} from '../../typechain';
import {advanceTimeAndBlock} from '../shared/helpers';
import {DeployConfig, DeployData, LP_PROVIDER} from '../../scripts/deploy/types';
import {BigNumber} from 'ethers';
import {setupTest} from '../setup';
import {solidity} from 'ethereum-waffle';
chai.use(solidity);
const {expect} = chai;

describe('Zapper', function () {
	let deployData: DeployData;
	let deployConfig: DeployConfig;

	let deployer: SignerWithAddress;
	let user2: SignerWithAddress;
	let user3: SignerWithAddress;
	let user4: SignerWithAddress;

	let lockZap: TestnetLockZap;
	let mfd: MultiFeeDistribution;

	const usdcPerAccount = ethers.utils.parseUnits('1000000000', 6);
	const wethPerAccount = ethers.utils.parseUnits('100', 18);
	const depositAmt = ethers.utils.parseUnits('1', 6);
	const depositAmtWeth = ethers.utils.parseUnits('1', 18);
	const SLIPPAGE_DIVISOR = BigNumber.from('10000');
	const MAX_SLIPPAGE = SLIPPAGE_DIVISOR.mul(950).div(1000);
	let USDC: MockToken;
	let usdcAddress = '';
	let rUSDCAddress = '';
	let WETH: WETH;
	let wethAddress = '';
	let rWETHAddress = '';
	let vdWETH: VariableDebtToken;
	let lendingPool: LendingPool;
	let chefIncentivesController: ChefIncentivesController;
	let eligibilityProvider: EligibilityDataProvider;
	let radiant: RadiantOFT;
	let poolHelperAddress: string;
	let liquidityZapAddress: string;
	let liquidityZap: LiquidityZap;
	let poolHelper: UniswapPoolHelper;
	let priceProvider: PriceProvider;

	beforeEach(async function () {
		const {deploy} = deployments;
		const fixture = await setupTest();

		deployData = fixture.deployData;
		deployConfig = fixture.deployConfig;

		deployer = fixture.deployer;
		user2 = fixture.user2;
		user3 = fixture.user3;
		user4 = fixture.user4;

		lockZap = <TestnetLockZap>fixture.lockZap;
		lendingPool = fixture.lendingPool;
		chefIncentivesController = fixture.chefIncentivesController;
		mfd = fixture.multiFeeDistribution;
		radiant = fixture.rdntToken;
		eligibilityProvider = fixture.eligibilityProvider;

		rUSDCAddress = deployData.allTokens.rUSDC;
		USDC = fixture.usdc;
		usdcAddress = USDC.address;

		rWETHAddress = deployData.allTokens.rWETH;
		vdWETH = deployData.allTokens.vdWETH;
		WETH = fixture.weth;
		wethAddress = WETH.address;

		poolHelperAddress = await lockZap.getPoolHelper();

		poolHelper = <UniswapPoolHelper>await ethers.getContractAt('UniswapPoolHelper', poolHelperAddress);
		priceProvider = fixture.priceProvider;
		if (deployConfig.LP_PROVIDER == LP_PROVIDER.UNISWAP) {
			liquidityZapAddress = await poolHelper.getLiquidityZap();
			liquidityZap = await ethers.getContractAt('LiquidityZap', liquidityZapAddress);
		}
	});

	it('init params validation', async () => {
		const zapFactory = await ethers.getContractFactory('LockZap');
		await expect(
			lockZap.initialize(
				poolHelper.address,
				lendingPool.address,
				wethAddress,
				radiant.address,
				1000,
				1000
			)
		).to.be.revertedWith('Contract instance has already been initialized');
		await expect(
			upgrades.deployProxy(
				zapFactory,
				[
					ethers.constants.AddressZero,
					lendingPool.address,
					wethAddress,
					radiant.address,
					1000,
					1000
				],
				{initializer: 'initialize'}
			)
		).to.be.revertedWith("AddressZero");
		await expect(
			upgrades.deployProxy(
				zapFactory,
				[
					poolHelper.address,
					ethers.constants.AddressZero,
					wethAddress,
					radiant.address,
					1000,
					1000
				],
				{initializer: 'initialize'}
			)
		).to.be.revertedWith("AddressZero");
		await expect(
			upgrades.deployProxy(
				zapFactory,
				[
					poolHelper.address,
					lendingPool.address,
					ethers.constants.AddressZero,
					radiant.address,
					1000,
					1000
				],
				{initializer: 'initialize'}
			)
		).to.be.revertedWith("AddressZero");
		await expect(
			upgrades.deployProxy(
				zapFactory,
				[
					poolHelper.address,
					lendingPool.address,
					wethAddress,
					ethers.constants.AddressZero,
					1000,
					1000
				],
				{initializer: 'initialize'}
			)
		).to.be.revertedWith("AddressZero");
		await expect(
			upgrades.deployProxy(
				zapFactory,
				[
					poolHelper.address,
					lendingPool.address,
					wethAddress,
					radiant.address,
					10001,
					1000
				],
				{initializer: 'initialize'}
			)
		).to.be.revertedWith("InvalidRatio");
	});

	it('setPriceProvider', async function () {
		await expect(lockZap.connect(user2).setPriceProvider(priceProvider.address)).to.be.revertedWith(
			'Ownable: caller is not the owner'
		);
		await expect(lockZap.setPriceProvider(ethers.constants.AddressZero)).to.be.revertedWith(
			'AddressZero'
		);
	});

	it('setMfd', async function () {
		await expect(lockZap.connect(user2).setMfd(priceProvider.address)).to.be.revertedWith(
			'Ownable: caller is not the owner'
		);
		await expect(lockZap.setMfd(ethers.constants.AddressZero)).to.be.revertedWith(
			'AddressZero'
		);
	});

	it('setPoolHelper', async function () {
		await expect(lockZap.connect(user2).setPoolHelper(priceProvider.address)).to.be.revertedWith(
			'Ownable: caller is not the owner'
		);
		await expect(lockZap.setPoolHelper(ethers.constants.AddressZero)).to.be.revertedWith(
			'AddressZero'
		);
	});

	describe("pause/unpause", async () => {
		it('owner permission', async () => {
			await expect(lockZap.connect(user2).pause()).to.be.revertedWith("Ownable: caller is not the owner");
			await expect(lockZap.connect(user2).unpause()).to.be.revertedWith("Ownable: caller is not the owner");
			await lockZap.pause();
			await lockZap.unpause();
		});

		it("functions when not paused", async () => {
			await lockZap.pause();
			await expect(lockZap.connect(user2).zap(true, 10, 10, 0)).to.be.revertedWith("Pausable: paused");
			await expect(lockZap.connect(user2).zapOnBehalf(true, 10, 10, user3.address)).to.be.revertedWith("Pausable: paused");
			await expect(lockZap.connect(user2).zapFromVesting(true, 0)).to.be.revertedWith("Pausable: paused");
		});
	});

	it("zapAlternateAsset", async () => {
		await lockZap.pause();
		await expect(lockZap.connect(user2).zapAlternateAsset(ethers.constants.AddressZero, 10, 0)).to.be.revertedWith("AddressZero");
		await expect(lockZap.connect(user2).zapAlternateAsset(usdcAddress, 0, 0)).to.be.revertedWith("AmountZero");
	});

	it('setLiquidityZap', async function () {
		if (deployConfig.LP_PROVIDER == LP_PROVIDER.UNISWAP) {
			await expect(poolHelper.connect(user2).setLiquidityZap(liquidityZapAddress)).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
			await poolHelper.setLiquidityZap(liquidityZapAddress);
		}
	});

	it('setPoolHelper', async function () {
		await expect(lockZap.connect(user2).setPoolHelper(poolHelperAddress)).to.be.revertedWith(
			'Ownable: caller is not the owner'
		);
		await lockZap.setPoolHelper(poolHelperAddress);
	});

	it('can zap into locked lp', async function () {
		await lockZap.connect(user2).zap(false, 0, 0, 0, 0, {
			value: ethers.utils.parseEther('1'),
		});

		const LP = <MockToken>await ethers.getContractAt('MockToken', deployData.stakingToken);

		expect(await LP.balanceOf(user2.address)).to.equal(BigNumber.from(0));
		expect((await mfd.lockedBalances(user2.address)).locked).to.be.gt(BigNumber.from(0));
	});

	it('zap fails with high slippage', async function () {
		await expect(lockZap.connect(user2).zap(false, 0, 0, 0, 9999, {
			value: ethers.utils.parseEther('1'),
		})).to.be.revertedWith("SlippageTooHigh");
		await expect(lockZap.connect(user2).zapOnBehalf(false, 0, 0, user2.address, 9999, {
			value: ethers.utils.parseEther('1'),
		})).to.be.revertedWith("SlippageTooHigh");
	});

	it('zap errors', async function () {
		await expect(lockZap.connect(user2).zap(false, 0, 0, 0, {
			value: ethers.utils.parseEther('0'),
		})).to.be.revertedWith("AmountZero");

		await expect(lockZap.connect(user2).zap(true, 0, 0, 0, {
			value: ethers.utils.parseEther('1'),
		})).to.be.revertedWith("InvalidZapETHSource");
	});

	it('can zap from Vesting', async function () {
		await lockZap.connect(user2).zap(false, 0, 0, 0, 0, {
			value: ethers.utils.parseEther('1'),
		});

		const lockedLpBalStart = (await mfd.lockedBalances(user2.address)).locked;

		expect(lockedLpBalStart).to.be.gt(BigNumber.from(0));

		await USDC.mint(user2.address, usdcPerAccount);
		await USDC.connect(user2).approve(lendingPool.address, ethers.constants.MaxUint256);
		await lendingPool.connect(user2).deposit(usdcAddress, depositAmt, user2.address, 0);

		expect(await eligibilityProvider.isEligibleForRewards(user2.address)).to.be.equal(true);

		await advanceTimeAndBlock(100000);

		await chefIncentivesController.claim(user2.address, [rUSDCAddress]);

		await advanceTimeAndBlock(deployConfig.MFD_VEST_DURATION + 1);

		await chefIncentivesController.claim(user2.address, [rUSDCAddress]);

		let totalVesting = (await mfd.earnedBalances(user2.address)).total;

		const wethRequired = await poolHelper.connect(user2).quoteFromToken(totalVesting);

		await expect(
			lockZap.connect(user2).zapFromVesting(false, 0, 0, {
				value: wethRequired.div(2),
			})
		).to.be.revertedWith('InsufficientETH');

		await lockZap.connect(user2).zapFromVesting(false, 0, 0, {
			value: wethRequired,
		});

		totalVesting = (await mfd.earnedBalances(user2.address)).totalVesting;

		const lockedLpBalEnd = (await mfd.lockedBalances(user2.address)).locked;
		expect(lockedLpBalEnd).to.be.gt(lockedLpBalStart);
		expect(totalVesting).to.be.equal(0);
	});

	it('can zap WETH, and from Borrow', async function () {
		await WETH.connect(user3).deposit({
			value: wethPerAccount,
		});

		await WETH.connect(user3).approve(lockZap.address, ethers.constants.MaxUint256);

		const lockedLpBal1 = (await mfd.lockedBalances(user3.address)).locked;
		expect(lockedLpBal1).to.equal(BigNumber.from(0));

		await lockZap.connect(user3).zap(false, depositAmtWeth, 0, 0, 0);

		const lockedLpBal2 = (await mfd.lockedBalances(user3.address)).locked;
		expect(lockedLpBal2).to.not.equal(BigNumber.from(0));

		await WETH.connect(user3).approve(lendingPool.address, ethers.constants.MaxUint256);

		const debtTokenAddress = await lockZap.getVDebtToken(wethAddress);
		vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', debtTokenAddress);
		await vdWETH.connect(user3).approveDelegation(lockZap.address, ethers.constants.MaxUint256);

		await lendingPool.connect(user3).deposit(wethAddress, depositAmtWeth.mul(5), user3.address, 0);

		expect((await lendingPool.getUserAccountData(user3.address)).totalCollateralETH).to.be.gt(BigNumber.from(0));

		await lockZap.connect(user3).zap(true, depositAmtWeth, 0, 0, 0);
		const lockedLpBal3 = (await mfd.lockedBalances(user3.address)).locked;

		expect(lockedLpBal3).to.be.gt(lockedLpBal2);
		expect((await lendingPool.getUserAccountData(user3.address)).totalDebtETH).to.be.gt(BigNumber.from(0));
	});

	it('can zap from Vesting w/ Borrow', async function () {
		// Become eligilble for rewards;
		await lockZap.connect(user4).zap(false, 0, 0, 0, 0, {
			value: wethPerAccount,
		});

		const lockedLpBal1 = (await mfd.lockedBalances(user4.address)).locked;

		await WETH.connect(user4).deposit({
			value: wethPerAccount,
		});

		await WETH.connect(user4).approve(lockZap.address, ethers.constants.MaxUint256);

		await WETH.connect(user4).approve(lendingPool.address, ethers.constants.MaxUint256);

		const debtTokenAddress = await lockZap.getVDebtToken(wethAddress);
		vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', debtTokenAddress);
		await vdWETH.connect(user4).approveDelegation(lockZap.address, ethers.constants.MaxUint256);

		await lendingPool.connect(user4).deposit(wethAddress, depositAmtWeth.mul(5), user4.address, 0);

		// expect((await lendingPool.getUserAccountData(user3.address)).totalCollateralETH).to.be.gt(BigNumber.from(0));
		// console.log(await lendingPool.getUserAccountData(user3.address));
		expect((await lendingPool.getUserAccountData(user4.address)).totalDebtETH).to.equal(BigNumber.from(0));

		expect(await eligibilityProvider.isEligibleForRewards(user4.address)).to.be.equal(true);

		await advanceTimeAndBlock(100000);

		await chefIncentivesController.claim(user4.address, [rWETHAddress]);

		let totalVesting = (await mfd.earnedBalances(user4.address)).totalVesting;

		await lendingPool.connect(user4).borrow(wethAddress, depositAmtWeth.mul(4), 2, 0, user4.address);

		await expect(lockZap.connect(user4).zapFromVesting(true, 0, 0)).to.be.revertedWith(
			'ExceedsAvailableBorrowsETH'
		);

		await lendingPool.connect(user4).deposit(wethAddress, depositAmtWeth.mul(5), user4.address, 0);

		await lockZap.connect(user4).zapFromVesting(true, 0, 0);

		totalVesting = (await mfd.earnedBalances(user4.address)).totalVesting;

		const lockedLpBal2 = (await mfd.lockedBalances(user4.address)).locked;
		expect(lockedLpBal2).to.be.gt(lockedLpBal1);
		expect(totalVesting).to.be.equal(0);
		expect((await lendingPool.getUserAccountData(user4.address)).totalDebtETH).to.be.gt(BigNumber.from(0));
		// console.log(await lendingPool.getUserAccountData(user4.address));
	});

	it('zap from Vesting fails with high slippage', async function () {
		await lockZap.setPriceProvider(priceProvider.address);

		// Become eligilble for rewards;
		await lockZap.connect(user4).zap(false, 0, 0, 0, 0, {
			value: wethPerAccount,
		});

		await WETH.connect(user4).deposit({
			value: wethPerAccount,
		});

		await WETH.connect(user4).approve(lockZap.address, ethers.constants.MaxUint256);

		await WETH.connect(user4).approve(lendingPool.address, ethers.constants.MaxUint256);

		const debtTokenAddress = await lockZap.getVDebtToken(wethAddress);
		vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', debtTokenAddress);
		await vdWETH.connect(user4).approveDelegation(lockZap.address, ethers.constants.MaxUint256);

		await lendingPool.connect(user4).deposit(wethAddress, depositAmtWeth.mul(5), user4.address, 0);

		await advanceTimeAndBlock(100000);

		await chefIncentivesController.claim(user4.address, [rWETHAddress]);

		await lendingPool.connect(user4).borrow(wethAddress, depositAmtWeth.mul(4), 2, 0, user4.address);

		await lendingPool.connect(user4).deposit(wethAddress, depositAmtWeth.mul(5), user4.address, 0);

		await expect(lockZap.connect(user4).zapFromVesting(true, 0, 10000)).to.be.revertedWith("SlippageTooHigh");
	});

	it('can early exit after zapping vesting w/ borrow', async function () {
		await WETH.connect(user4).deposit({
			value: wethPerAccount,
		});

		await WETH.connect(user4).approve(lockZap.address, ethers.constants.MaxUint256);

		await WETH.connect(user4).approve(lendingPool.address, ethers.constants.MaxUint256);

		const debtTokenAddress = await lockZap.getVDebtToken(wethAddress);
		vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', debtTokenAddress);
		await vdWETH.connect(user4).approveDelegation(lockZap.address, ethers.constants.MaxUint256);

		await lendingPool.connect(user4).deposit(wethAddress, depositAmtWeth, user4.address, 0);

		expect((await lendingPool.getUserAccountData(user4.address)).totalCollateralETH).to.be.gt(BigNumber.from(0));
		expect((await lendingPool.getUserAccountData(user4.address)).totalDebtETH).to.equal(BigNumber.from(0));

		// Become eligilble for rewards;
		await lockZap.connect(user4).zap(false, 0, 0, 0, 0, {
			value: depositAmtWeth,
		});

		const lockedLpBal1 = (await mfd.lockedBalances(user4.address)).locked;

		expect(await eligibilityProvider.isEligibleForRewards(user4.address)).to.be.equal(true);

		await advanceTimeAndBlock(100000);

		await chefIncentivesController.claim(user4.address, [rWETHAddress]);

		let totalVesting = (await mfd.earnedBalances(user4.address)).totalVesting;

		await lockZap.connect(user4).zapFromVesting(true, 0, 0);

		totalVesting = (await mfd.earnedBalances(user4.address)).totalVesting;

		const lockedLpBal2 = (await mfd.lockedBalances(user4.address)).locked;
		expect(lockedLpBal2).to.be.gt(lockedLpBal1);
		expect(totalVesting).to.be.equal(0);
		expect((await lendingPool.getUserAccountData(user4.address)).totalDebtETH).to.be.gt(BigNumber.from(0));

		await chefIncentivesController.claim(user4.address, [rWETHAddress]);
		expect((await mfd.earnedBalances(user4.address)).totalVesting).to.be.gt(BigNumber.from(0));

		const rdntBal1 = await radiant.balanceOf(user4.address);
		await mfd.connect(user4).exit(false);
		const rdntBal2 = await radiant.balanceOf(user4.address);
		expect(rdntBal2).to.be.gt(rdntBal1);
	});

	describe('LiquidityZap', async () => {
		it('initLiquidityZap again fails', async () => {
			if (liquidityZap) {
				await expect(
					liquidityZap.initLiquidityZap(
						ethers.constants.AddressZero,
						ethers.constants.AddressZero,
						ethers.constants.AddressZero,
						ethers.constants.AddressZero
					)
				).to.be.reverted;
			}
		});

		it('fallback', async () => {
			if (liquidityZap) {
				await expect(
					deployer.sendTransaction({
						to: liquidityZap.address,
						value: ethers.utils.parseEther('1'),
					})
				).to.be.not.reverted;
			}
		});

		it('zapEth validation', async () => {
			if (liquidityZap) {
				await expect(liquidityZap.zapETH(user2.address)).to.be.revertedWith('InvalidETHAmount');
			}
		});

		it('zapEth validation', async () => {
			if (liquidityZap) {
				await expect(
					liquidityZap.addLiquidityETHOnly(ethers.constants.AddressZero, {
						value: ethers.utils.parseEther('1'),
					})
				).to.be.revertedWith('AddressZero');

				await expect(liquidityZap.addLiquidityETHOnly(user2.address)).to.be.revertedWith('InvalidETHAmount');

				expect(await liquidityZap.quote(ethers.utils.parseEther('1'))).to.be.gt(0);
				expect(await liquidityZap.getLPTokenPerEthUnit(ethers.utils.parseEther('1'))).to.be.gt(0);
			}
		});
	});
	describe('Alternate token zap', async () => {
		it('Can zap USDC', async () => {
			const zapAmount = ethers.BigNumber.from(100 * 10 ** 6);
			await USDC.approve(lockZap.address, zapAmount);
			const lockedLpBalanceBefore = (await mfd.lockedBalances(deployer.address)).locked;
			await lockZap.zapAlternateAsset(usdcAddress, zapAmount, 0, 0);
			const lockedLpBalanceAfter = (await mfd.lockedBalances(deployer.address)).locked;
			const lockedLpBalanceGained = lockedLpBalanceAfter.sub(lockedLpBalanceBefore);

			const lpTokenPriceUsd = await priceProvider.getLpTokenPriceUsd();
			const lpValueGained = lockedLpBalanceGained.mul(lpTokenPriceUsd).div(10 ** 8);
			const minAcceptedRatio = 9500;
			const bpsUnit = 10_000;
			const minAcceptedLpValue = zapAmount
				.mul(10 ** 12)
				.mul(minAcceptedRatio)
				.div(bpsUnit);

			expect(lpValueGained).to.be.gt(minAcceptedLpValue);
		});

		it('Zap fails with high slippage', async () => {
			await lockZap.setPriceProvider(priceProvider.address);
			const zapAmount = ethers.BigNumber.from(100 * 10 ** 6);
			await USDC.approve(lockZap.address, zapAmount);
			await expect(lockZap.zapAlternateAsset(usdcAddress, zapAmount, 0, 9999)).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT");
		});

		it('slippage limits are not breached', async () => {
			const reserves = await poolHelper.getReserves();
			const lpTokens = reserves.lpTokenSupply;
			const lpTokenPriceUsd = await priceProvider.getLpTokenPriceUsd();
			const poolValueInUSD = lpTokens.mul(lpTokenPriceUsd).div(ethers.utils.parseUnits('1', 18));
			console.log('poolValueInUSD: ', poolValueInUSD.toString());

			// We trade 0.001% of the pool value
			const zapAmount = poolValueInUSD.div(1000000); // div 1000000 instead of 100000 to account for USDC 6 decimals

			await USDC.approve(lockZap.address, zapAmount);
			const tooTightSlippageLimit = SLIPPAGE_DIVISOR.mul(999).div(1000); // 0.1% slippage
			await expect(
				lockZap.zapAlternateAsset(usdcAddress, zapAmount, 0, tooTightSlippageLimit)
			).to.be.revertedWith('UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT');

			const tooLooseSlippageLimit = SLIPPAGE_DIVISOR.mul(95).div(100).sub(1); // >5% slippage
			await expect(
				lockZap.zapAlternateAsset(usdcAddress, zapAmount, 0, tooLooseSlippageLimit)
			).to.be.revertedWith('SpecifiedSlippageExceedLimit');

			await lockZap.zapAlternateAsset(usdcAddress, zapAmount, 0, 0);
		});
	});

	it('Locked ETH in lockZap contract', async () => {
		const depositAmount = ethers.utils.parseEther('1');
		await deployer.sendTransaction({
			to: lockZap.address,
			value: depositAmount,
		});

		const user2Eth0 = await user2.getBalance();
		await lockZap.withdrawLockedETH(user2.address, depositAmount);
		const user2Eth1 = await user2.getBalance();

		expect(user2Eth1.sub(user2Eth0)).to.be.equal(depositAmount);
	});

	it('errors', async () => {
		const zapAmount = ethers.BigNumber.from(10 * 10 ** 6);
		await lockZap.setPriceProvider(priceProvider.address);
		await USDC.approve(lockZap.address, zapAmount);
		// await lockZap.setAcceptableRatio(10000);
		// await expect(lockZap.zapAlternateAsset(usdcAddress, zapAmount, 0)).to.be.revertedWith("InvalidSlippage");

		await lockZap.zapAlternateAsset(usdcAddress, zapAmount, 0, 0);

	});
});
