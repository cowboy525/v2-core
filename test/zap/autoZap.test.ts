import {ethers} from 'hardhat';
import {VariableDebtToken} from '../../typechain';
import _ from 'lodash';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
import {advanceTimeAndBlock} from './../shared/helpers';
import {FixtureDeploy} from '../../scripts/deploy/types';
import {setupTest} from '../setup';

chai.use(solidity);
const {expect} = chai;

describe('Looping/Leverager', () => {
	let vdWETH: VariableDebtToken;
	let wethAddress = '';

	const FEE_LOOPING = '1000';

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
		const {leverager, deployConfig, weth}: FixtureDeploy = await setupTest();

		wethAddress = weth.address;
		await leverager.setFeePercent(FEE_LOOPING);
	});

	it('autoZap test with slippage', async () => {
		const {lendingPool, leverager, eligibilityProvider, priceProvider, wethGateway, user1}: FixtureDeploy =
			await setupTest();

		let vdWETHAddress = await leverager.getVDebtToken(wethAddress);
		vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', vdWETHAddress);
		await vdWETH.connect(user1).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		await wethGateway.connect(user1).depositETH(lendingPool.address, user1.address, 0, {
			value: ethers.utils.parseEther('50'),
		});

		expect(await eligibilityProvider.isEligibleForRewards(user1.address)).to.equal(false);

		const required1 = await eligibilityProvider.requiredUsdValue(user1.address);
		const locked1 = await eligibilityProvider.lockedUsdValue(user1.address);
		// console.log("required1: ", parseFloat(ethers.utils.formatUnits(required1, 8)));
		// console.log("locked1: ", parseFloat(ethers.utils.formatUnits(locked1, 8)));

		let leverage = 4;
		let borrowRatio = Math.floor(loopingLeverageToLtv(leverage) * 10000);
		let loops = significantLoopingCount(leverage);
		await leverager.connect(user1).loopETH(2, borrowRatio, loops, {
			value: ethers.utils.parseEther('10'),
		});

		await advanceTimeAndBlock(3601);
		await priceProvider.update();

		// TODO: check these numbers
		const required2 = await eligibilityProvider.requiredUsdValue(user1.address);
		const locked2 = await eligibilityProvider.lockedUsdValue(user1.address);
		// console.log("required2: ", parseFloat(ethers.utils.formatUnits(required2, 8)));
		// console.log("locked2: ", parseFloat(ethers.utils.formatUnits(locked2, 8)));

		expect(await eligibilityProvider.isEligibleForRewards(user1.address)).to.equal(true);
	});
});
