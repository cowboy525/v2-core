import {ethers} from 'hardhat';
import {
	BountyManager,
	EligibilityDataProvider,
	Compounder,
	ManualOracle,
	PriceProvider,
	TestnetLockZap,
	MultiFeeDistribution,
	MiddleFeeDistribution,
	AToken,
	LockerList,
} from '../typechain';

const _ = require('lodash');
const hre = require('hardhat');
const {deployments, getNamedAccounts} = hre;

(async () => {
	const {execute, deploy, read} = deployments;
	const {deployer} = await getNamedAccounts();
	let amt = ethers.utils.parseEther('1000000');
	const mfd = <MultiFeeDistribution>await ethers.getContract('MFD');

	console.log(await mfd.rewardsLookback());

	// console.log(await read('MFD', 'getRewardForDuration', '0x4Ff2DD7c6435789E0BB56B0553142Ad00878a004'));
	// console.log(await read('MFD', 'rewardData', '0x4Ff2DD7c6435789E0BB56B0553142Ad00878a004'));

	// // console.log(await mfd.rewardsLookback());
	// await execute('MFD', {from: deployer}, 'setLookback', 0);
	await execute('MFD', {from: deployer}, 'setLookback', 86400);
	console.log(await mfd.rewardsLookback());
	// await execute('MFD', {from: deployer}, 'getAllRewards');

	// console.log(await read('MFD', 'getRewardForDuration', '0x4Ff2DD7c6435789E0BB56B0553142Ad00878a004'));
	// console.log(await read('MFD', 'rewardData', '0x4Ff2DD7c6435789E0BB56B0553142Ad00878a004'));
})();
