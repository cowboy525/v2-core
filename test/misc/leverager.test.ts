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
	let vdUSDC: VariableDebtToken;
	let vdWETH: VariableDebtToken;
	let usdcAddress = '';
	let wethAddress = '';
	const usdcAmt = 1000;

	const FEE_LOOPING = '1000';

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
		const {deployConfig, deployData, usdc, weth}: FixtureDeploy = await setupTest();

		usdcAddress = usdc.address;
		wethAddress = weth.address;
		rUSDC = <AToken>await ethers.getContractAt('mockERC20', deployData.allTokens.rUSDC);
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

		const required1 = await eligibilityProvider.requiredUsdValue(user2.address);
		const locked1 = await eligibilityProvider.lockedUsdValue(user2.address);
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
		const required2 = await eligibilityProvider.requiredUsdValue(user2.address);
		const locked2 = await eligibilityProvider.lockedUsdValue(user2.address);
	});

	it('loop ETH from Borrow', async () => {
		const {leverager, wethGateway, lendingPool, user2, usdc, weth}: FixtureDeploy = await setupTest();

		await leverager.setFeePercent(FEE_LOOPING);

		let vdWETHAddress = await leverager.getVDebtToken(wethAddress);
		vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', vdWETHAddress);

		await vdUSDC.connect(user2).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		await vdWETH.connect(user2).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		const ethBalance = await ethers.provider.getBalance(user2.address);

		await wethGateway.connect(user2).depositETH(lendingPool.address, user2.address, 0, {
			value: ethBalance,
		});

		const ethBalance2 = await ethers.provider.getBalance(user2.address);
		expect(ethBalance2).to.equal(BigNumber.from(0));

		let borrowRatio = 8000;
		let amt = usdcPerAccount;
		let loops = 1;
		await leverager.connect(user2).loopETHFromBorrow(2, amt, borrowRatio, loops, 0);
	});
});
