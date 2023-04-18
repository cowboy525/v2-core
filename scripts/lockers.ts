import {BigNumber} from 'ethers';
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
import {advanceTimeAndBlock} from './utils';

const _ = require('lodash');
const hre = require('hardhat');
const {deployments, getNamedAccounts} = hre;

(async () => {
	const {execute, deploy, read} = deployments;
	const {deployer, test} = await getNamedAccounts();
	let amt = ethers.utils.parseEther('1000000');

	const mfd = <MultiFeeDistribution>await ethers.getContract('MFD');
	const list = <LockerList>await ethers.getContract('LockerList');

	let count = await list.lockersCount();
	console.log(count);

	let users = await list.getUsers(0, count);
	// console.log(users);

	let results = [];
	let lockData = [];

	for (let i = 0; i < users.length; i++) {
		const user = users[i];
		let res = await mfd.lockedBalances(user);
		console.log(res);
		lockData = [...lockData, res.lockData];
	}

	console.log(lockData);
	let r = _.flatten(lockData).map((lock) => {
		return {
			amt: lock.amount,
			multi: lock.multiplier,
		};
	});

	let amounts = {
		1: BigNumber.from(0),
		4: BigNumber.from(0),
		10: BigNumber.from(0),
		25: BigNumber.from(0),
	};
	let totalAmt = BigNumber.from(0);

	for await (const lock of r) {
		// let amt =
		console.log();
		let index = parseInt(lock.multi);
		let value = BigNumber.from(lock.amt);
		amounts[index] = amounts[index].add(value);
		totalAmt = totalAmt.add(value);
	}
	console.log(amounts);
	console.log();

	let power = {
		1: BigNumber.from(0),
		4: BigNumber.from(0),
		10: BigNumber.from(0),
		25: BigNumber.from(0),
	};
	let totalPower = BigNumber.from(0);
	for (const key in amounts) {
		let cohortPower = BigNumber.from(key).mul(amounts[key]);
		power[key] = cohortPower;
		totalPower = totalPower.add(cohortPower);
	}

	console.log(power);
	console.log(totalPower);

	let powerShare = {
		1: BigNumber.from(0),
		4: BigNumber.from(0),
		10: BigNumber.from(0),
		25: BigNumber.from(0),
	};
	let totalPow = parseFloat(ethers.utils.formatEther(totalPower));
	console.log(`Total power: ${totalPow}`);

	for (const key in power) {
		let pow = parseFloat(ethers.utils.formatEther(power[key]));
		let amt = parseFloat(ethers.utils.formatEther(amounts[key]));
		console.log(key);
		console.log(pow);
		console.log(`Power share: ${pow / totalPow}`);
		console.log(`Pool Size share: ${amt / parseFloat(ethers.utils.formatEther(totalAmt))}`);
	}
})();
