import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {ethers} from 'hardhat';
import {
	AToken,
	LendingPool,
	Leverager,
	MockToken,
	VariableDebtToken,
	EligibilityDataProvider,
	WETHGateway,
	PriceProvider,
	WETH,
} from '../../typechain';
import _ from 'lodash';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
import {BigNumber} from 'ethers';
import {setupTest} from '../setup';

import {advanceTimeAndBlock} from './../shared/helpers';
import {DeployConfig, DeployData, FixtureDeploy} from '../../scripts/deploy/types';
import {loadFixture} from '@nomicfoundation/hardhat-network-helpers';
chai.use(solidity);
const {expect} = chai;

describe('Looping/Leverager', () => {
	let rUSDC: AToken;
	let rWETH: AToken;
	let vdUSDC: VariableDebtToken;
	let vdWETH: VariableDebtToken;
	let WETH: WETH;
	let usdcAddress = '';
	let wethAddress = '';
	let treasuryAddress = '';
	const usdcAmt = 1000;

	const FEE_LOOPING = '100';

	const usdcPerAccount = ethers.utils.parseUnits(usdcAmt.toString(), 6);

	const loopingLeverageToLtv = (leverage: number) => {
		return 1 - 1 / leverage;
	};

	const significantLoopingCount = (leverage: number, significantDigits = 1, maxCount = 40) => {
		const ltv = loopingLeverageToLtv(leverage);
		let currentleverage = 1;
		let prevLtv = ltv;
		const significantNum = 10 ** (significantDigits * -1);
		for (let i = 1; i < 40; i++) {
			currentleverage = currentleverage + prevLtv;
			prevLtv = prevLtv * ltv;
			if (leverage - currentleverage < significantNum) return Math.max(i, 2);
		}

		return maxCount;
	};

	before(async () => {
		const {deployData, usdc, weth, treasury}: FixtureDeploy = await setupTest();

		treasuryAddress = treasury.address;
		usdcAddress = usdc.address;
		wethAddress = weth.address;
		rUSDC = <AToken>await ethers.getContractAt('mockERC20', deployData.allTokens.rUSDC);
		rWETH = <AToken>await ethers.getContractAt('mockERC20', deployData.allTokens.rWETH);
	});

	it('deploy', async () => {
		const {user2}: FixtureDeploy = await setupTest();
		const Leverager = await ethers.getContractFactory('Leverager');
		await expect(
			Leverager.deploy(
				ethers.constants.AddressZero,
				user2.address,
				user2.address,
				user2.address,
				user2.address,
				user2.address,
				100,
				user2.address,
				0
			)
		).to.be.revertedWith('AddressZero');
		await expect(
			Leverager.deploy(
				user2.address,
				ethers.constants.AddressZero,
				user2.address,
				user2.address,
				user2.address,
				user2.address,
				100,
				user2.address,
				0
			)
		).to.be.revertedWith('AddressZero');
		await expect(
			Leverager.deploy(
				user2.address,
				user2.address,
				ethers.constants.AddressZero,
				user2.address,
				user2.address,
				user2.address,
				100,
				user2.address,
				0
			)
		).to.be.revertedWith('AddressZero');
		await expect(
			Leverager.deploy(
				user2.address,
				user2.address,
				user2.address,
				ethers.constants.AddressZero,
				user2.address,
				user2.address,
				100,
				user2.address,
				0
			)
		).to.be.revertedWith('AddressZero');
		await expect(
			Leverager.deploy(
				user2.address,
				user2.address,
				user2.address,
				user2.address,
				ethers.constants.AddressZero,
				user2.address,
				100,
				user2.address,
				0
			)
		).to.be.revertedWith('AddressZero');
		await expect(
			Leverager.deploy(
				user2.address,
				user2.address,
				user2.address,
				user2.address,
				user2.address,
				ethers.constants.AddressZero,
				100,
				user2.address,
				0
			)
		).to.be.revertedWith('AddressZero');
		await expect(
			Leverager.deploy(
				user2.address,
				user2.address,
				user2.address,
				user2.address,
				user2.address,
				user2.address,
				100,
				ethers.constants.AddressZero,
				0
			)
		).to.be.revertedWith('AddressZero');
		await expect(
			Leverager.deploy(
				user2.address,
				user2.address,
				user2.address,
				user2.address,
				user2.address,
				user2.address,
				10001,
				user2.address,
				0
			)
		).to.be.revertedWith('InvalidRatio');
	});

	it('receive not allowed', async () => {
		const {leverager, user2}: FixtureDeploy = await setupTest();
		await expect(
			user2.sendTransaction({
				to: leverager.address,
				value: ethers.utils.parseEther('1'),
			})
		).to.be.revertedWith('ReceiveNotAllowed');
	});

	it('fallback not allowed', async () => {
		const {leverager, user2}: FixtureDeploy = await setupTest();
		await expect(
			user2.sendTransaction({
				to: leverager.address,
				value: ethers.utils.parseEther('1'),
				data: '0xabcdef',
			})
		).to.be.revertedWith('FallbackNotAllowed');
	});

	it('setFeePercent', async function () {
		const {leverager, user2}: FixtureDeploy = await setupTest();

		await expect(leverager.connect(user2).setFeePercent(1000)).to.be.revertedWith(
			'Ownable: caller is not the owner'
		);
		await expect(leverager.setFeePercent(10001)).to.be.revertedWith('InvalidRatio');
	});

	it('setTreasury', async function () {
		const {leverager, user2, treasury}: FixtureDeploy = await setupTest();

		await expect(leverager.connect(user2).setTreasury(treasury.address)).to.be.revertedWith(
			'Ownable: caller is not the owner'
		);
		await expect(leverager.setTreasury(ethers.constants.AddressZero)).to.be.revertedWith('AddressZero');
		await leverager.setTreasury(treasury.address);
	});

	it('returns debt token w/ getVDebtToken', async () => {
		const {leverager, deployData, usdc}: FixtureDeploy = await setupTest();

		const debtTokenAddress = await leverager.getVDebtToken(usdc.address);
		vdUSDC = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', debtTokenAddress);

		expect(vdUSDC.address).to.equal(deployData.allTokens.vdUSDC);

		const configuration = await leverager.getConfiguration(usdcAddress);
		const ltv = await leverager.ltv(usdcAddress);
		expect(configuration.data.mod(2 ** 16)).to.be.equal(ltv);
	});

	it('borrows & deposits correct amount, w/ correct fee', async () => {
		const {leverager, wethGateway, lendingPool, user2, usdc}: FixtureDeploy = await setupTest();

		const value0 = await leverager.wethToZap(user2.address);
		expect(value0).to.be.equal(0);

		await leverager.setFeePercent(FEE_LOOPING);

		let vdWETHAddress = await leverager.getVDebtToken(wethAddress);
		vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', vdWETHAddress);

		await vdUSDC.connect(user2).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		await vdWETH.connect(user2).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		await wethGateway.connect(user2).depositETH(lendingPool.address, user2.address, 0, {
			value: ethers.utils.parseEther('1000'),
		});

		await usdc.connect(user2).mint(user2.address, usdcPerAccount);
		await usdc.connect(user2).approve(leverager.address, ethers.constants.MaxUint256);

		let borrowRatio = 8000;
		let amt = usdcPerAccount;
		let loops = 1;

		await expect(leverager.connect(user2).loop(usdcAddress, amt, 2, 10001, loops, false, 0)).to.be.revertedWith(
			'InvalidRatio'
		);

		await leverager.connect(user2).loop(usdcAddress, amt, 2, borrowRatio, loops, false, 0);

		const initialFee = amt.mul(FEE_LOOPING).div(1e4);
		const initialDeposit = amt.sub(initialFee);

		const loop1Borrow = initialDeposit.mul(BigNumber.from(borrowRatio)).div(1e4);

		const loop1Fee = loop1Borrow.mul(FEE_LOOPING).div(1e4);
		const loop1Deposit = loop1Borrow.sub(loop1Fee);

		const totalUserDeposits = initialDeposit.add(loop1Deposit);
		const totalUserBorrows = loop1Borrow;
		const totalFees = initialFee.add(loop1Fee);

		expect(await usdc.balanceOf(user2.address)).to.equal(BigNumber.from(0));
		expect(await rUSDC.balanceOf(user2.address)).to.equal(totalUserDeposits);
		expect(await vdUSDC.balanceOf(user2.address)).to.equal(totalUserBorrows);
		// expect(await USDC.balanceOf(treasury.address)).to.equal(totalFees);

		await leverager.connect(user2).loop(usdcAddress, amt, 2, borrowRatio, loops, true, 0);
	});

	it('borrows & deposits correct ETH amount, w/ correct fee', async () => {
		const {leverager, wethGateway, lendingPool, user2, usdc}: FixtureDeploy = await setupTest();

		let borrowRatio = 8000;
		let amt = ethers.utils.parseEther(usdcAmt.toString());
		let loops = 1;

		const value0 = await leverager.wethToZapEstimation(user2.address, usdcAddress, 0, borrowRatio, loops);
		expect(value0).to.be.equal(0);

		await leverager.setFeePercent(FEE_LOOPING);

		let vdWETHAddress = await leverager.getVDebtToken(wethAddress);
		vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', vdWETHAddress);

		await vdWETH.connect(user2).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		await wethGateway.connect(user2).depositETH(lendingPool.address, user2.address, 0, {
			value: ethers.utils.parseEther('1000'),
		});

		const rWETH0 = await rWETH.balanceOf(user2.address);
		const vdWETH0 = await vdWETH.balanceOf(user2.address);

		await expect(leverager.connect(user2).loopETH(2, 10001, loops, 0)).to.be.revertedWith('InvalidRatio');

		await leverager.connect(user2).loopETH(2, borrowRatio, loops, 0, {value: amt});

		const initialFee = amt.mul(FEE_LOOPING).div(1e4);
		const initialDeposit = amt.sub(initialFee);

		const loop1Borrow = initialDeposit.mul(BigNumber.from(borrowRatio)).div(1e4);

		const loop1Fee = loop1Borrow.mul(FEE_LOOPING).div(1e4);
		const loop1Deposit = loop1Borrow.sub(loop1Fee);

		const totalUserDeposits = initialDeposit.add(loop1Deposit);
		const totalUserBorrows = loop1Borrow;
		const totalFees = initialFee.add(loop1Fee);

		const rWETH1 = await rWETH.balanceOf(user2.address);
		const vdWETH1 = await vdWETH.balanceOf(user2.address);

		expect(rWETH1.sub(rWETH0)).to.equal(totalUserDeposits);
		// expect(vdWETH1.sub(vdWETH0)).to.equal(totalUserBorrows);
		// expect(await USDC.balanceOf(treasury.address)).to.equal(totalFees);

		await leverager.connect(user2).loopETH(2, borrowRatio, loops, 0, {value: amt});

		// WETH to Zap estimation
		const value1 = await leverager.wethToZapEstimation(user2.address, usdcAddress, amt, borrowRatio, loops);
		expect(value1).to.be.gt(0);
		const value2 = await leverager.wethToZapEstimation(
			user2.address,
			'0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
			amt.div(10),
			borrowRatio,
			loops
		);
		expect(value2).to.be.gt(0);

		await expect(leverager.zapWETHWithBorrow(amt, user2.address, 0)).to.be.revertedWith('InsufficientPermission');
		await leverager.connect(user2).zapWETHWithBorrow(0, user2.address, 0);
		await leverager.connect(user2).zapWETHWithBorrow(amt.div(10), user2.address, 0);
	});

	it('borrows & deposits correct ETH amount from borrow, w/ correct fee', async () => {
		const {leverager, wethGateway, lendingPool, user2, usdc}: FixtureDeploy = await setupTest();

		await leverager.setFeePercent(FEE_LOOPING);

		let vdWETHAddress = await leverager.getVDebtToken(wethAddress);
		vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', vdWETHAddress);

		await vdUSDC.connect(user2).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		await vdWETH.connect(user2).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		await wethGateway.connect(user2).depositETH(lendingPool.address, user2.address, 0, {
			value: ethers.utils.parseEther('1000'),
		});

		await usdc.connect(user2).mint(user2.address, usdcPerAccount);
		await usdc.connect(user2).approve(leverager.address, ethers.constants.MaxUint256);

		let borrowRatio = 8000;
		let amt = usdcPerAccount;
		let loops = 1;
		await expect(
			leverager.connect(user2).loop(usdcAddress, amt, 2, borrowRatio, loops, false, 9999)
		).to.be.revertedWith('SlippageTooHigh');

		const rWETH0 = await rWETH.balanceOf(user2.address);
		const vdWETH0 = await vdWETH.balanceOf(user2.address);

		await expect(leverager.connect(user2).loopETHFromBorrow(2, amt, 10001, loops, 0)).to.be.revertedWith(
			'InvalidRatio'
		);

		await leverager.connect(user2).loopETHFromBorrow(2, amt, borrowRatio, loops, 0);

		const initialFee = amt.mul(FEE_LOOPING).div(1e4);
		const initialDeposit = amt.sub(initialFee);

		const loop1Borrow = initialDeposit.mul(BigNumber.from(borrowRatio)).div(1e4);

		const loop1Fee = loop1Borrow.mul(FEE_LOOPING).div(1e4);
		const loop1Deposit = loop1Borrow.sub(loop1Fee);

		const totalUserDeposits = initialDeposit.add(loop1Deposit);
		const totalUserBorrows = loop1Borrow;
		const totalFees = initialFee.add(loop1Fee);

		const rWETH1 = await rWETH.balanceOf(user2.address);
		const vdWETH1 = await vdWETH.balanceOf(user2.address);

		await leverager.connect(user2).loopETHFromBorrow(2, amt, borrowRatio, loops, 0);
	});

	it('autoZap while looping', async () => {
		const {
			leverager,
			wethGateway,
			lendingPool,
			priceProvider,
			eligibilityProvider,
			usdc,
			user2,
			user3,
		}: FixtureDeploy = await setupTest();

		const testUSDCAmount = ethers.utils.parseUnits('2000000', 6);
		const testUSDCDeposit = ethers.utils.parseUnits('1000290.5', 6);
		const testUSDCBorrow = ethers.utils.parseUnits('198258.39', 6);

		await usdc.connect(user2).mint(user2.address, testUSDCAmount);
		await usdc.connect(user2).approve(lendingPool.address, ethers.constants.MaxUint256);
		await usdc.connect(user2).approve(leverager.address, ethers.constants.MaxUint256);
		await lendingPool.connect(user2).deposit(usdcAddress, testUSDCDeposit, user2.address, 0);

		await lendingPool.connect(user2).borrow(usdcAddress, testUSDCBorrow, 2, 0, user2.address);

		const vdWETHAddress = await leverager.getVDebtToken(wethAddress);
		await usdc.connect(user2).mint(user2.address, usdcPerAccount);
		vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', vdWETHAddress);
		await vdWETH.connect(user2).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		await vdUSDC.connect(user2).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		await vdWETH.connect(user2).approveDelegation(wethGateway.address, ethers.constants.MaxUint256);

		await wethGateway.connect(user3).depositETH(lendingPool.address, user3.address, 0, {
			value: ethers.utils.parseEther('5000'),
		});

		await wethGateway.connect(user2).borrowETH(lendingPool.address, ethers.utils.parseEther('0.04'), 2, 0);

		expect(await eligibilityProvider.isEligibleForRewards(user2.address)).to.equal(false);

		let amt = ethers.utils.parseUnits('197967.89677', 6);
		let leverage = 1.1;
		let borrowRatio = Math.floor(loopingLeverageToLtv(leverage) * 10000);
		let loops = significantLoopingCount(leverage);

		await usdc.connect(user2).mint(user2.address, amt);

		await leverager.connect(user2).loop(usdcAddress, amt, 2, borrowRatio, loops, false, 0);
		await advanceTimeAndBlock(3601);
		await priceProvider.update();
		expect(await eligibilityProvider.isEligibleForRewards(user2.address)).to.equal(true);
		// TODO: check these numbers
	});

	it('loop ETH from Borrow with correct fees', async () => {
		const {leverager, wethGateway, lendingPool, user2}: FixtureDeploy = await setupTest();

		await leverager.setFeePercent(FEE_LOOPING);

		let vdWETHAddress = await leverager.getVDebtToken(wethAddress);
		vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', vdWETHAddress);

		await vdUSDC.connect(user2).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		await vdWETH.connect(user2).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		const ethBalance = await (await ethers.provider.getBalance(user2.address)).div(2);

		await wethGateway.connect(user2).depositETH(lendingPool.address, user2.address, 0, {
			value: ethBalance,
		});

		const ethBalance2 = await ethers.provider.getBalance(user2.address);
		expect(ethBalance2).to.equal(ethBalance);

		let borrowRatio = 8000;
		let amt = ethers.utils.parseEther('1');
		let loops = 2;

		const initialFee = amt.mul(FEE_LOOPING).div(1e4);
		const initialDeposit = amt.sub(initialFee);
		const loop1Borrow = initialDeposit.mul(BigNumber.from(borrowRatio)).div(1e4);
		const loop1Fee = loop1Borrow.mul(FEE_LOOPING).div(1e4);
		const totalFees = initialFee.add(loop1Fee);

		const treasuryEth0 = await ethers.provider.getBalance(treasuryAddress);

		await leverager.connect(user2).loopETHFromBorrow(2, amt, borrowRatio, loops, 0);

		const tresuryEth1 = await ethers.provider.getBalance(treasuryAddress);
		expect(tresuryEth1.sub(treasuryEth0)).to.equal(totalFees);
	});

	it('loop ETH with correct fees', async () => {
		const {leverager, user2}: FixtureDeploy = await setupTest();

		await leverager.setFeePercent(FEE_LOOPING);

		let vdWETHAddress = await leverager.getVDebtToken(wethAddress);
		vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', vdWETHAddress);
		await vdWETH.connect(user2).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		let borrowRatio = 8000;
		let amt = ethers.utils.parseEther('1');
		let loops = 2;

		const initialFee = amt.mul(FEE_LOOPING).div(1e4);
		const initialDeposit = amt.sub(initialFee);
		const loop1Borrow = initialDeposit.mul(BigNumber.from(borrowRatio)).div(1e4);
		const loop1Fee = loop1Borrow.mul(FEE_LOOPING).div(1e4);
		const loop2Borrow = loop1Borrow.sub(loop1Fee).mul(BigNumber.from(borrowRatio)).div(1e4);
		const loop2Fee = loop2Borrow.mul(FEE_LOOPING).div(1e4);
		const totalFees = initialFee.add(loop1Fee).add(loop2Fee);

		const treasuryEth0 = await ethers.provider.getBalance(treasuryAddress);

		await leverager.connect(user2).loopETH(2, borrowRatio, loops, 9700, {value: amt});

		const tresuryEth1 = await ethers.provider.getBalance(treasuryAddress);
		expect(tresuryEth1.sub(treasuryEth0)).to.equal(totalFees);
	});

	it('loop ETH reverts with high slippage', async () => {
		const {leverager, user2}: FixtureDeploy = await setupTest();

		await leverager.setFeePercent(FEE_LOOPING);

		let vdWETHAddress = await leverager.getVDebtToken(wethAddress);
		vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', vdWETHAddress);
		await vdWETH.connect(user2).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		let borrowRatio = 8000;
		let amt = ethers.utils.parseEther('1');
		let loops = 2;
		await expect(leverager.connect(user2).loopETH(2, borrowRatio, loops, 9999, {value: amt})).to.be.revertedWith(
			'SlippageTooHigh'
		);
	});

	it('Eligibility Exempt is Temporary', async () => {
		const {leverager, wethGateway, lendingPool, user2, usdc, chefIncentivesController}: FixtureDeploy =
			await setupTest();

		await leverager.setFeePercent(FEE_LOOPING);

		let vdWETHAddress = await leverager.getVDebtToken(wethAddress);
		vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', vdWETHAddress);

		await vdUSDC.connect(user2).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		await vdWETH.connect(user2).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		await wethGateway.connect(user2).depositETH(lendingPool.address, user2.address, 0, {
			value: ethers.utils.parseEther('1000'),
		});

		await usdc.connect(user2).mint(user2.address, usdcPerAccount.div(2));
		await usdc.connect(user2).approve(leverager.address, ethers.constants.MaxUint256);

		const isEligibleExempt = await chefIncentivesController.eligibilityExempt(user2.address);
		expect(isEligibleExempt).to.equal(0);

		let borrowRatio = 8000;
		let amt = usdcPerAccount;
		let loops = 1;
		await leverager.connect(user2).loopETHFromBorrow(2, amt, borrowRatio, loops, 0);

		expect(await chefIncentivesController.eligibilityExempt(user2.address)).to.equal(isEligibleExempt);
	});

	it('loop eth from borrow fails with high slippage', async () => {
		const {leverager, wethGateway, lendingPool, user2, usdc, chefIncentivesController}: FixtureDeploy =
			await setupTest();

		await leverager.setFeePercent(FEE_LOOPING);

		let vdWETHAddress = await leverager.getVDebtToken(wethAddress);
		vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', vdWETHAddress);

		await vdUSDC.connect(user2).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		await vdWETH.connect(user2).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		await wethGateway.connect(user2).depositETH(lendingPool.address, user2.address, 0, {
			value: ethers.utils.parseEther('1000'),
		});

		let borrowRatio = 8000;
		let amt = usdcPerAccount;
		let loops = 1;
		await expect(leverager.connect(user2).loopETHFromBorrow(2, amt, borrowRatio, loops, 9999)).to.be.revertedWith(
			'SlippageTooHigh'
		);
	});

	it('zap weth with borrow fails with high slippage', async () => {
		const {leverager, wethGateway, lendingPool, user2, usdc, chefIncentivesController}: FixtureDeploy =
			await setupTest();

		await leverager.setFeePercent(FEE_LOOPING);

		let vdWETHAddress = await leverager.getVDebtToken(wethAddress);
		vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', vdWETHAddress);

		await vdUSDC.connect(user2).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		await vdWETH.connect(user2).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		await wethGateway.connect(user2).depositETH(lendingPool.address, user2.address, 0, {
			value: ethers.utils.parseEther('1000'),
		});

		let amt = ethers.utils.parseEther('10');
		await expect(leverager.connect(user2).zapWETHWithBorrow(amt, user2.address, 9999)).to.be.revertedWith(
			'SlippageTooHigh'
		);
	});

	it('fail when loopCount is 0', async () => {
		const {leverager}: FixtureDeploy = await setupTest();
		await expect(leverager.loop(usdcAddress, 0, 2, 10, 0, false, 0)).to.be.revertedWith('InvalidLoopCount');

		await expect(leverager.loopETHFromBorrow(2, 0, 10, 0, 0)).to.be.revertedWith('InvalidLoopCount');

		await expect(leverager.loopETH(0, 10, 0, 0)).to.be.revertedWith('InvalidLoopCount');
	});

	it('fail when exceeding the value boundaries', async () => {
		const {leverager}: FixtureDeploy = await setupTest();
		await expect(leverager.setFeePercent('10001')).to.be.revertedWith('InvalidRatio');

		await expect(leverager.loop(usdcAddress, 0, 2, 0, 0, false, 0)).to.be.revertedWith('InvalidRatio');
		await expect(leverager.loop(usdcAddress, 0, 2, 10001, 0, false, 0)).to.be.revertedWith('InvalidRatio');

		await expect(leverager.loopETH(0, 0, 0, 0)).to.be.revertedWith('InvalidRatio');
		await expect(leverager.loopETH(0, 10001, 0, 0)).to.be.revertedWith('InvalidRatio');

		await expect(leverager.loopETHFromBorrow(2, 0, 0, 0, 0)).to.be.revertedWith('InvalidRatio');
		await expect(leverager.loopETHFromBorrow(2, 0, 10001, 0, 0)).to.be.revertedWith('InvalidRatio');
	});
});
