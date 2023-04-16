import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {ethers} from 'hardhat';
import {
	ChefIncentivesController,
	LendingPool,
	MultiFeeDistribution,
	MockToken,
	EligibilityDataProvider,
} from '../../typechain';
import _ from 'lodash';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
import {DeployConfig, DeployData} from '../../scripts/deploy/types';
import {setupTest} from '../setup';
import {advanceTimeAndBlock, zapIntoEligibility} from '../shared/helpers';
chai.use(solidity);
const {expect} = chai;

describe('Ensure Users can borrow after Eligibility change (no sub revert)', () => {
	let user2: SignerWithAddress;

	let USDC: MockToken;

	let lendingPool: LendingPool;
	let multiFeeDistribution: MultiFeeDistribution;
	let eligibilityDataProvider: EligibilityDataProvider;
	let chef: ChefIncentivesController;

	let usdcAddress = '';
	const tokenPerAccount = ethers.utils.parseUnits('999999220', 6);

	let deployData: DeployData;
	let deployConfig: DeployConfig;

	before(async () => {
		const fixture = await setupTest();

		deployData = fixture.deployData;
		deployConfig = fixture.deployConfig;

		user2 = fixture.user2;

		USDC = fixture.usdc;
		usdcAddress = USDC.address;

		lendingPool = fixture.lendingPool;
		chef = fixture.chefIncentivesController;
		multiFeeDistribution = fixture.multiFeeDistribution;
		eligibilityDataProvider = fixture.eligibilityProvider;

		await USDC.mint(user2.address, tokenPerAccount);
		await USDC.connect(user2).approve(lendingPool.address, ethers.constants.MaxUint256);
	});

	it('Deposit and Lock by User 2', async () => {
		await zapIntoEligibility(user2, deployData);

		await lendingPool.connect(user2).deposit(usdcAddress, '1000000', user2.address, 0);

		expect(await eligibilityDataProvider.isEligibleForRewards(user2.address)).to.be.equal(true);
	});

	it('Wait for lock expire, user 2 borrow, ensure no revert', async () => {
		const lockDuration = await multiFeeDistribution.defaultLockDuration();
		await advanceTimeAndBlock(lockDuration.mul(2).toNumber());

		// revisit re: claim/dep self-DQ
		// expect(await eligibilityDataProvider.isEligibleForRewards(user2.address)).to.be.equal(false);

		await lendingPool.connect(user2).borrow(usdcAddress, '100000', 2, 0, user2.address);

		await expect(chef.pendingRewards(user2.address, deployData.allTokenAddrs)).to.be.not.reverted;
	});
});
