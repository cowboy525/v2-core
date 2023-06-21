import {ethers} from 'hardhat';
import {VariableDebtToken} from '../../typechain';
import _ from 'lodash';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
import {advanceTimeAndBlock} from './../shared/helpers';
import {FixtureDeploy} from '../../scripts/deploy/types';
import {setupTest} from '../setup';
import {BigNumber} from 'ethers';

chai.use(solidity);
const {expect} = chai;

describe('Deposit/AutoZap', () => {
	let vdWETH: VariableDebtToken;

	const FEE_LOOPING = '1000';
	const SLIPPAGE_DIVISOR = BigNumber.from('10000');
	const MAX_SLIPPAGE = SLIPPAGE_DIVISOR.mul(950).div(1000);

	before(async () => {
		const {leverager}: FixtureDeploy = await setupTest();

		await leverager.setFeePercent(FEE_LOOPING);
	});

	it('autoZap test while deposit', async () => {
		const {lendingPool, leverager, eligibilityProvider, priceProvider, wethGateway, user1, weth}: FixtureDeploy =
			await setupTest();

		await wethGateway.connect(user1).depositETH(lendingPool.address, user1.address, 0, {
			value: ethers.utils.parseEther('5000'),
		});

		expect(await eligibilityProvider.isEligibleForRewards(user1.address)).to.equal(false);

		let vdWETHAddress = await leverager.getVDebtToken(weth.address);
		vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', vdWETHAddress);
		await vdWETH.connect(user1).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		await wethGateway.connect(user1).depositETHWithAutoDLP(lendingPool.address, user1.address, 0, 0, {
			value: ethers.utils.parseEther('1000'),
		});

		await advanceTimeAndBlock(3601);
		await priceProvider.update();

		expect(await eligibilityProvider.isEligibleForRewards(user1.address)).to.equal(true);
	});

	it('slippage limits are not breached', async () => {
		const {lendingPool, leverager, lockZap, wethGateway, user1, weth}: FixtureDeploy = await setupTest();

		let vdWETHAddress = await leverager.getVDebtToken(weth.address);
		vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', vdWETHAddress);
		await vdWETH.connect(user1).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		// Test Improvement:
		// Determine the tradable amount from the current liquidity available in the relevant pool
		const tradeAmount = ethers.utils.parseEther('1000');

		// Specified slippage limit is too tight for market conditions
		const tooTightSlippageLimit = SLIPPAGE_DIVISOR.mul(995).div(1000); // 0.5% slippage
		await expect(
			wethGateway
				.connect(user1)
				.depositETHWithAutoDLP(lendingPool.address, user1.address, 0, tooTightSlippageLimit, {
					value: tradeAmount,
				})
		).to.be.revertedWith('SlippageTooHigh');

		// Specified slippage limit allows for trade
		await wethGateway.connect(user1).depositETHWithAutoDLP(lendingPool.address, user1.address, 0, MAX_SLIPPAGE, {
			value: tradeAmount,
		});

		// Specified slippage limit is higher then the protocol allows
		const tooLooseSlippageLimit = SLIPPAGE_DIVISOR.mul(95).div(100).sub(1); // >5% slippage
		await expect(
			wethGateway
				.connect(user1)
				.depositETHWithAutoDLP(lendingPool.address, user1.address, 0, tooLooseSlippageLimit, {
					value: tradeAmount,
				})
		).to.be.revertedWith('SpecifiedSlippageExceedLimit');

		// No specification results in default slippage limit
		const defaultSlippage = '0';
		await wethGateway.connect(user1).depositETHWithAutoDLP(lendingPool.address, user1.address, 0, defaultSlippage, {
			value: tradeAmount,
		});
	});
});
