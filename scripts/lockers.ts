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

	console.log(await read('MFD', 'getRewardForDuration', '0xd69D402D1bDB9A2b8c3d88D98b9CEaf9e4Cd72d9'));
	console.log(await read('MFD', 'rewardData', '0xd69D402D1bDB9A2b8c3d88D98b9CEaf9e4Cd72d9'));
	// await execute('MFD', {from: deployer}, 'setLookback', 86400);

	// let res2 = await read('MFD', 'lockedSupplyWithMultiplier');
	// console.log(res2);

	// const signer1 = await hre.ethers.getSigner(test);
	// let mfd = await hre.ethers.getContract('MFD');
	// await mfd.connect(signer1).getAllRewards();

	// console.log(await read('MFD', 'getRewardForDuration', '0xd69D402D1bDB9A2b8c3d88D98b9CEaf9e4Cd72d9'));
	// console.log(await read('MFD', 'getRewardForDuration', '0xd69D402D1bDB9A2b8c3d88D98b9CEaf9e4Cd72d9'));
	// console.log(await read('MFD', 'rewardData', '0xd69D402D1bDB9A2b8c3d88D98b9CEaf9e4Cd72d9'));

	// await advanceTimeAndBlock(6 * 60 * 60);
	// console.log(await read('MFD', 'claimableRewards', test));

	const mfd = <MultiFeeDistribution>await ethers.getContract('MFD');
	// const middle = <MiddleFeeDistribution>await ethers.getContract('MiddleFeeDistribution');
	// const bm = <BountyManager>await ethers.getContract('BountyManager');

	// // await bm.setMinStakeAmount(0);

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

		// let claimable = await mfd.claimableRewards(user);
		// console.log(claimable);

		// let usdt = parseFloat(ethers.utils.formatEther(claimable[2].amount));
		// let usdt = claimable[2].amount;
		// console.log(usdt);

		// console.log(res);
		// results.push({
		// 	user,
		// 	locked: parseFloat(ethers.utils.formatEther(res.locked)),
		// 	power: parseFloat(ethers.utils.formatEther(res.lockedWithMultiplier)),
		// 	usdt,
		// });
		// console.log(user);
		// let quote = await bm.quote(user);
		// console.log(quote.bounty);
	}

	// results = _.orderBy(results, ['power'], ['desc']);
	// console.table(results);

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

	// console.log(r);

	// console.log(_.pick(_.flatten(lockData), ['amount', 'multiplier']));

	// console.log(await mfd.claimableRewards('0x70997970C51812dc3A010C7d01b50e0d17dc79C8'));
	// console.log(await mfd.rewardsDuration());
	// console.log(await mfd.rewardsLookback());
	// console.log(await mfd.rewardData('0xd69d402d1bdb9a2b8c3d88d98b9ceaf9e4cd72d9'));
	// console.log(await mfd.getRewardForDuration('0xd69d402d1bdb9a2b8c3d88d98b9ceaf9e4cd72d9'));

	// let rusdc = <AToken>await ethers.getContractAt('AToken', '0x775Bc80658656D0845041EA13BBEA5f0CEa8E792');
	// console.log(rusdc.address);

	// let bal = await rusdc.balanceOf(middle.address);
	// console.log(bal);

	// await execute('MFD', {from: deployer, log: true}, 'addRewardConverter', c.address);

	// await execute('Compounder', {from: deployer}, 'setBountyManager', bm.address);
	// let r = await c.selfCompound();
	// console.log(r);

	// await deploy('RadiantOracle2', {
	// 	contract: 'ManualOracle',
	// 	from: deployer,
	// 	log: true,
	// 	proxy: {
	// 		proxyContract: 'OpenZeppelinTransparentProxy',
	// 		execute: {
	// 			methodName: 'initialize',
	// 			args: ['0xBa834DF195A14ffEFeaCd6729e30e60C8246BA70', '0x44835cAB81AD49b2685697C299D9208De89aADa9'],
	// 		},
	// 	},
	// });
	// await execute('RadiantOracle2', {from: deployer, log: true}, 'setPrice', 75000000000000);
	// const o = <ManualOracle>await ethers.getContract('RadiantOracle2');
	// console.log(await o.latestAnswer());
	// console.log(await o.latestAnswerInEth());

	// await execute('PriceProvider', {from: deployer}, 'changeOracle', '0x81EBC4d3894D09F812abA5D0fc8B00131C6Ab09C');
	// console.log(await pp.getTokenPriceUsd());
})();
