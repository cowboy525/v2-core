import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import assert from 'assert';
import {advanceTimeAndBlock} from '../../scripts/utils';
import {MultiFeeDistribution} from '../../typechain';
import _ from 'lodash';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
import {DeployConfig, DeployData} from '../../scripts/deploy/types';
import {setupTest} from '../setup';

chai.use(solidity);
const {expect} = chai;

describe('MFD Durations', () => {
	let user2: SignerWithAddress;
	let user3: SignerWithAddress;
	let multiFeeDistribution: MultiFeeDistribution;

	let deployData: DeployData;
	let deployConfig: DeployConfig;

	before(async () => {
		const fixture = await setupTest();

		deployData = fixture.deployData;
		deployConfig = fixture.deployConfig;

		user2 = fixture.user2;
		user3 = fixture.user3;

		multiFeeDistribution = fixture.multiFeeDistribution;
	});

	it('returns lock durations', async () => {
		const lockDurations = await multiFeeDistribution.getLockDurations();
		expect(lockDurations.length).equals(deployConfig.LOCK_INFO.LOCK_PERIOD.length);
	});

	it('returns lock multipliers', async () => {
		const lockMultis = await multiFeeDistribution.getLockMultipliers();
		expect(lockMultis.length).equals(deployConfig.LOCK_INFO.MULTIPLIER.length);
	});
});
