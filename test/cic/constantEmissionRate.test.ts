import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {ethers} from 'hardhat';
import {loadFixture} from '@nomicfoundation/hardhat-network-helpers';
import chai, {expect} from 'chai';
import {solidity} from 'ethereum-waffle';
import {
	advanceTimeAndBlock,
	depositAndBorrowAll,
	getLatestBlockTimestamp,
	getTotalPendingRewards,
	zapIntoEligibility,
} from '../shared/helpers';
import {DeployConfig, DeployData} from '../../scripts/deploy/types';
import {setupTest} from '../setup';
import {ChefIncentivesController, EligibilityDataProvider} from '../../typechain';

chai.use(solidity);

describe('Ensure Emissions consistant', () => {
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let eligibilityProvider: EligibilityDataProvider;
	let cic: ChefIncentivesController;
	let deployData: DeployData;
	let deployConfig: DeployConfig;

	before(async () => {
		const fixture = await setupTest();

		deployData = fixture.deployData;
		deployConfig = fixture.deployConfig;

		user2 = fixture.user2;
		user1 = fixture.deployer;

		cic = fixture.chefIncentivesController;
		eligibilityProvider = fixture.eligibilityProvider;

		await cic.connect(user1).setEligibilityEnabled(false);
	});

	it('user1 emission rate unchanged after user2 deposits', async () => {
		await depositAndBorrowAll(user2, ['0.1', '10'], deployData);
		await zapIntoEligibility(user2, deployData);

		const startTimestamp = await getLatestBlockTimestamp();

		expect(await eligibilityProvider.isEligibleForRewards(user2.address)).to.be.equal(true);

		const initialPendingRewards = await getTotalPendingRewards(user2.address, cic);

		const SKIP_DURATION = 120;
		await advanceTimeAndBlock(SKIP_DURATION);

		const pendingRewards1 = await getTotalPendingRewards(user2.address, cic);
		const expectedRewards1 = deployConfig.CIC_RPS.mul(SKIP_DURATION);

		let rewardsGained = pendingRewards1.sub(initialPendingRewards);

		expect(parseFloat(ethers.utils.formatUnits(rewardsGained.toString(), 18))).to.be.approximately(
			parseFloat(ethers.utils.formatUnits(expectedRewards1.toString(), 18)),
			4
		);
		console.log("F")

		await depositAndBorrowAll(user1, ['150', '10000000'], deployData);

		await advanceTimeAndBlock(SKIP_DURATION);
		const currentTimestamp = await getLatestBlockTimestamp();
		const DURATION = currentTimestamp - startTimestamp;

		const pendingRewards2 = await getTotalPendingRewards(user2.address, cic);
		rewardsGained = pendingRewards2.sub(initialPendingRewards);

		const emissionRate2 = rewardsGained.div(DURATION);
		expect(emissionRate2).to.be.not.equal(deployConfig.CIC_RPS);
	});
});
