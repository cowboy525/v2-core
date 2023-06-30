import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import assert from 'assert';
import {ethers, upgrades} from 'hardhat';
import {LendingPool, MockToken, StargateBorrow, VariableDebtToken, WETH} from '../../typechain';
import _ from 'lodash';
import chai, {expect} from 'chai';
import {solidity} from 'ethereum-waffle';
import {DeployConfig, DeployData} from '../../scripts/deploy/types';
import {setupTest} from '../setup';

chai.use(solidity);

describe('Stargate Borrow', () => {
	let deployData: DeployData;
	let deployConfig: DeployConfig;

	let user2: SignerWithAddress;
	let treasury: SignerWithAddress;
	let USDC: MockToken;
	let wrappedEth: WETH;
	let lendingPool: LendingPool;
	let stargateBorrow: StargateBorrow;
	let variableDebtUSDC: VariableDebtToken;
	let variableDebtWETH: VariableDebtToken;

	let usdcAddress = '';
	let wethAddress = '';

	const usdcAmt = 10000000;
	const usdcPerAccount = ethers.utils.parseUnits(usdcAmt.toString(), 6);
	const borrowAmt = ethers.utils.parseUnits((usdcAmt * 0.5).toString(), 6);
	const INITIAL_MAX_SLIPPAGE = "99";

	before(async () => {
		const fixture = await setupTest();

		deployData = fixture.deployData;
		deployConfig = fixture.deployConfig;

		treasury = fixture.treasury;
		wrappedEth = fixture.weth;
		user2 = fixture.user2;

		USDC = <MockToken>await ethers.getContractAt('MockToken', fixture.usdc.address);
		wrappedEth = <WETH>await ethers.getContractAt('WETH', fixture.weth.address);
		wethAddress = wrappedEth.address;
		usdcAddress = USDC.address;

		variableDebtUSDC = <VariableDebtToken>(
			await ethers.getContractAt('VariableDebtToken', deployData.allTokens.vdUSDC)
		);
		variableDebtWETH = <VariableDebtToken>(
			await ethers.getContractAt('VariableDebtToken', deployData.allTokens.vdWETH)
		);
		lendingPool = <LendingPool>await ethers.getContractAt('LendingPool', deployData.lendingPool);

		const MockRouter = await ethers.getContractFactory('MockRouter');
		const mockRouter = await MockRouter.deploy();

		const MockRouterETH = await ethers.getContractFactory('MockRouterETH');
		const mockRouterETH = await MockRouterETH.deploy();

		const StargateBorrow = await ethers.getContractFactory('StargateBorrow');
		stargateBorrow = <StargateBorrow>(
			await upgrades.deployProxy(StargateBorrow, [
				mockRouter.address,
				mockRouterETH.address,
				lendingPool.address,
				wrappedEth.address,
				fixture.treasury.address,
				deployConfig.FEE_XCHAIN_BORROW,
				INITIAL_MAX_SLIPPAGE,
			], {unsafeAllow: ['constructor']})
		);
		//stargateBorrow = <StargateBorrow> await ethers.getContractAt("StargateBorrow", deployData.stargateBorrow);
	});

	it('setDAOTreasury', async () => {
		await expect(stargateBorrow.connect(user2).setDAOTreasury(treasury.address)).to.be.revertedWith(
			'Ownable: caller is not the owner'
		);
		await stargateBorrow.setDAOTreasury(treasury.address);
	});

	it('setXChainBorrowFeePercent', async () => {
		await expect(
			stargateBorrow.connect(user2).setXChainBorrowFeePercent(deployConfig.FEE_XCHAIN_BORROW)
		).to.be.revertedWith('Ownable: caller is not the owner');
		await stargateBorrow.setXChainBorrowFeePercent(deployConfig.FEE_XCHAIN_BORROW);
	});

	it('setMaxSlippage', async () => {
		const NEW_MAX_SLIPPAGE = "98";
		const TOO_LOW_MAX_SLIPPAGE = "79";
		await expect(
			stargateBorrow.connect(user2).setMaxSlippage(NEW_MAX_SLIPPAGE)
		).to.be.revertedWith('Ownable: caller is not the owner');

		await expect(
			stargateBorrow.setMaxSlippage(TOO_LOW_MAX_SLIPPAGE)
		).to.be.revertedWith('SlippageSetToHigh');
		await stargateBorrow.setMaxSlippage(NEW_MAX_SLIPPAGE);

		//Set back to old slippage level
		await stargateBorrow.setMaxSlippage(INITIAL_MAX_SLIPPAGE);
	});

	it('Check X Chain Borrow Fee', async () => {
		await USDC.connect(user2).mint(user2.address, usdcPerAccount);

		await USDC.connect(user2).approve(lendingPool.address, ethers.constants.MaxUint256);

		await USDC.connect(user2).approve(stargateBorrow.address, ethers.constants.MaxUint256);

		await variableDebtUSDC.connect(user2).approveDelegation(stargateBorrow.address, ethers.constants.MaxUint256);

		await lendingPool.connect(user2).deposit(usdcAddress, usdcPerAccount, user2.address, 0);

		const initBal = await USDC.balanceOf(treasury.address);

		const feeAmount = await stargateBorrow.getXChainBorrowFeeAmount(borrowAmt);

		await stargateBorrow.quoteLayerZeroSwapFee(10143, 1, user2.address, '0x', {
			dstGasForCall: 0, // extra gas, if calling smart contract,
			dstNativeAmount: 0, // amount of dust dropped in destination wallet
			dstNativeAddr: user2.address, // destination wallet for dust
		});

		//Should comment out router.swap of borrow function in the StargateBorrow.sol
		await stargateBorrow.connect(user2).borrow(usdcAddress, borrowAmt, 2, 10143);

		const tresuaryBal = await USDC.balanceOf(treasury.address);

		const delta = tresuaryBal.sub(initBal);

		assert.equal(delta.toString(), feeAmount.toString(), `Check Dao Balance.`);
	});

	it('borrow eth', async () => {
		const wethAmt = ethers.utils.parseEther('1');
		await wrappedEth.connect(user2).deposit({
			value: wethAmt,
		});

		await wrappedEth.connect(user2).approve(lendingPool.address, ethers.constants.MaxUint256);

		await wrappedEth.connect(user2).approve(stargateBorrow.address, ethers.constants.MaxUint256);

		await variableDebtWETH.connect(user2).approveDelegation(stargateBorrow.address, ethers.constants.MaxUint256);

		await lendingPool.connect(user2).deposit(wethAddress, wethAmt, user2.address, 0);

		const initBal = await treasury.getBalance();
		const feeAmount = await stargateBorrow.getXChainBorrowFeeAmount(borrowAmt);

		//Should comment out router.swap of borrow function in the StargateBorrow.sol
		await stargateBorrow.connect(user2).borrow('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', borrowAmt, 2, 10143);

		const tresuaryBal = await treasury.getBalance();
		const delta = tresuaryBal.sub(initBal);
		assert.equal(delta.toString(), feeAmount.toString(), `Check Dao Balance.`);
	});

	it('invalid treasury', async () => {
		const wethAmt = ethers.utils.parseEther('1');
		await wrappedEth.connect(user2).deposit({
			value: wethAmt,
		});

		await wrappedEth.connect(user2).approve(lendingPool.address, ethers.constants.MaxUint256);

		await wrappedEth.connect(user2).approve(stargateBorrow.address, ethers.constants.MaxUint256);

		await variableDebtWETH.connect(user2).approveDelegation(stargateBorrow.address, ethers.constants.MaxUint256);

		await lendingPool.connect(user2).deposit(wethAddress, wethAmt, user2.address, 0);

		await stargateBorrow.setDAOTreasury(wethAddress);
		await expect(
			stargateBorrow.connect(user2).borrow('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', borrowAmt, 2, 10143)
		).to.be.revertedWith('ETHTransferFailed');
	});

	it('fail when exceeding the value boundaries', async () => {
		await expect(
			stargateBorrow.setXChainBorrowFeePercent(101)
		).to.be.revertedWith('InvalidRatio');
	});
});
