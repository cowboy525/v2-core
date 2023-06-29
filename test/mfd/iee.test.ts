import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import assert from 'assert';
import {ethers} from 'hardhat';
import {getLatestBlockTimestamp, setNextBlockTimestamp} from '../../scripts/utils';
import {ChefIncentivesController, LendingPool, MultiFeeDistribution, RadiantOFT, WETH} from '../../typechain';
import _ from 'lodash';
import chai, {expect} from 'chai';
import {solidity} from 'ethereum-waffle';
import {zapIntoEligibility} from '../shared/helpers';
import {DeployConfig, DeployData} from '../../scripts/deploy/types';
import {setupTest} from '../setup';

chai.use(solidity);

describe('Individual Early Exits', () => {
	let user1: SignerWithAddress;
	let dao: SignerWithAddress;
	let mfd: MultiFeeDistribution;
	let lendingPool: LendingPool;
	let chefIncentivesController: ChefIncentivesController;
	let radiant: RadiantOFT;
	let WETH: WETH;

	const QUART = 25000; //  25%
	const HALF = 65000; //  65%
	const WHOLE = 100000; // 100%
	// const BURN  =  20000; //  60%
	let BURN = '0'; //  60%

	let wethAddress = '';
	let rWETHAddress = '';
	const depositAmtWeth = ethers.utils.parseUnits('1', 18);

	let deployData: DeployData;
	let deployConfig: DeployConfig;

	before(async () => {
		const fixture = await setupTest();

		deployData = fixture.deployData;
		deployConfig = fixture.deployConfig;

		dao = fixture.dao;
		user1 = fixture.user1;

		lendingPool = fixture.lendingPool;
		radiant = fixture.rdntToken;
		mfd = fixture.multiFeeDistribution;
		chefIncentivesController = fixture.chefIncentivesController;

		BURN = deployConfig.STARFLEET_RATIO;

		wethAddress = fixture.weth.address;

		rWETHAddress = deployData.allTokens.rWETH;
		WETH = <WETH>await ethers.getContractAt('WETH', wethAddress);
	});

	it('Check Individual Early Exit.', async () => {
		// Deposit assets to earn RDNT
		await WETH.connect(user1).deposit({
			value: depositAmtWeth,
		});

		await WETH.connect(user1).approve(lendingPool.address, ethers.constants.MaxUint256);

		await lendingPool.connect(user1).deposit(wethAddress, depositAmtWeth, user1.address, 0);

		// Become Emission Eligible
		await zapIntoEligibility(user1, deployData);

		const VEST_DURATION = await mfd.vestDuration();

		const userBal0 = await radiant.balanceOf(user1.address);
		const daoBal0 = await radiant.balanceOf(dao.address);

		await chefIncentivesController.claim(user1.address, [rWETHAddress]);

		const blockTimestamp = await getLatestBlockTimestamp();
		const unlockTime = blockTimestamp + VEST_DURATION.toNumber();

		const totalVesting = (await mfd.earnedBalances(user1.address)).totalVesting;

		await setNextBlockTimestamp(blockTimestamp + 1000);

		const penaltyFactor = Math.floor(
			QUART + (HALF * (unlockTime - blockTimestamp - 1000)) / VEST_DURATION.toNumber()
		);
		const penalty = totalVesting.mul(penaltyFactor).div(WHOLE);
		const amount = totalVesting.sub(penalty);
		const burnAmount = penalty.mul(BURN).div(WHOLE);

		await mfd.connect(user1).individualEarlyExit(false, unlockTime);
		const userBal1 = await radiant.balanceOf(user1.address);
		const daoBal1 = await radiant.balanceOf(dao.address);

		assert.equal(
			userBal1.sub(userBal0).toString(),
			amount.toString(),
			`Withdraw to user with penalty when early exit.`
		);
		assert.equal(
			daoBal1.sub(daoBal0).toString(),
			penalty.sub(burnAmount).toString(),
			`Send penalty amount to dao treasury.`
		);
	});
	it('IEE handles invalid end time', async () => {
		// Deposit assets to earn RDNT
		await WETH.connect(user1).deposit({
			value: depositAmtWeth,
		});

		await WETH.connect(user1).approve(lendingPool.address, ethers.constants.MaxUint256);

		await lendingPool.connect(user1).deposit(wethAddress, depositAmtWeth, user1.address, 0);

		// Become Emission Eligible
		await zapIntoEligibility(user1, deployData);

		const VEST_DURATION = await mfd.vestDuration();

		const userBal0 = await radiant.balanceOf(user1.address);
		const daoBal0 = await radiant.balanceOf(dao.address);

		await chefIncentivesController.claim(user1.address, [rWETHAddress]);

		const blockTimestamp = await getLatestBlockTimestamp();
		const unlockTime = blockTimestamp + VEST_DURATION.toNumber();

		const totalVesting = (await mfd.earnedBalances(user1.address)).total;

		await setNextBlockTimestamp(blockTimestamp + 1000);

		const penaltyFactor = Math.floor(
			QUART + (HALF * (unlockTime - blockTimestamp - 1000)) / VEST_DURATION.toNumber()
		);
		const penalty = totalVesting.mul(penaltyFactor).div(WHOLE);
		const amount = totalVesting.sub(penalty);
		const burnAmount = penalty.mul(BURN).div(WHOLE);

		await expect(mfd.connect(user1).individualEarlyExit(false, 9999999999999)).to.be.revertedWith(
			'UnlockTimeNotFound'
		);

		await mfd.connect(user1).exit(false);

		const userBal1 = await radiant.balanceOf(user1.address);
		const daoBal1 = await radiant.balanceOf(dao.address);

		assert.equal(userBal0.add(totalVesting).sub(penalty).toString(), userBal1.toString());
		assert.equal(daoBal0.add(penalty).sub(burnAmount).toString(), daoBal1.toString());
	});
});
