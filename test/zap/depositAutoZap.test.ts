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

describe('Deposit/AutoZap', () => {
	let vdWETH: VariableDebtToken;

	const FEE_LOOPING = '1000';

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

		await wethGateway.connect(user1).depositETHWithAutoDLP(lendingPool.address, user1.address, 0, {
			value: ethers.utils.parseEther('1000'),
		});

		await advanceTimeAndBlock(3601);
		await priceProvider.update();

		expect(await eligibilityProvider.isEligibleForRewards(user1.address)).to.equal(true);
	});
});
