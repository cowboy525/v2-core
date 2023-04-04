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
import {getWeth} from './getDepenencies';

const _ = require('lodash');
const hre = require('hardhat');
const {deployments, getNamedAccounts} = hre;

(async () => {
	const {execute, deploy, read, get} = deployments;
	const {deployer} = await getNamedAccounts();
	let amt = ethers.utils.parseEther('1000000');
	const mfd = <MultiFeeDistribution>await ethers.getContract('MFD');
	const middle = <MiddleFeeDistribution>await ethers.getContract('MiddleFeeDistribution');
	const pp = <MiddleFeeDistribution>await ethers.getContract('PriceProvider');
	const bm = <BountyManager>await ethers.getContract('BountyManager');

	await execute('LockZap', {from: deployer, log: true}, 'setPriceProvider', pp.address);

	await execute('UniV2TwapOracle', {from: deployer}, 'update');
	console.log(await read('PriceProvider', {from: deployer}, 'getTokenPrice'));

	// const token = (await get('RadiantOFT')).address;
	// const {weth} = await getWeth(hre);
	// const _weth = weth.address;

	// let tokenWethPair = await read('PoolHelper', 'lpTokenAddr');
	// let lz = await read('PoolHelper', 'liquidityZap');
	// console.log(lz);

	// let _helper = (await get('PoolHelper')).address;
	// console.log(_helper);

	// let other = await read('LiquidityZap', 'poolHelper');
	// let other2 = await get('LiquidityZap');
	// console.log(other);
	// console.log(other2.address);

	// console.log((await get('LockZap')).address);
	// console.log(await read('LockZap', 'poolHelper'));

	// await execute('LockZap', {from: deployer}, 'setPoolHelper', _helper);

	// console.log(_helper);
	// console.log(other);

	// console.log(await read('PriceProvider', 'oracle'));
	// await execute(
	// 	'LiquidityZap',
	// 	{from: deployer, log: true},
	// 	'initLiquidityZap',
	// 	token,
	// 	_weth,
	// 	tokenWethPair,
	// 	_helper
	// );

	// await bm.setMinStakeAmount(0);

	// const list = <LockerList>await ethers.getContract('LockerList');

	// let count = await list.lockersCount();
	// console.log(count);

	// let users = await list.getUsers(0, count);
	// // console.log(users);

	// let results = [];

	// for (let i = 0; i < users.length; i++) {
	// 	const user = users[i];
	// 	let res = await mfd.lockedBalances(user);
	// 	// console.log(res);

	// 	let claimable = await mfd.claimableRewards(user);
	// 	// console.log(claimable);

	// 	// let usdt = parseFloat(ethers.utils.formatEther(claimable[2].amount));
	// 	let usdt = claimable[2].amount;
	// 	// console.log(usdt);

	// 	// console.log(res);
	// 	results.push({
	// 		user,
	// 		locked: parseFloat(ethers.utils.formatEther(res.locked)),
	// 		power: parseFloat(ethers.utils.formatEther(res.lockedWithMultiplier)),
	// 		usdt,
	// 	});
	// 	// console.log(user);
	// 	// let quote = await bm.quote(user);
	// 	// console.log(quote.bounty);
	// }

	// results = _.orderBy(results, ['power'], ['desc']);
	// console.table(results);

	// console.log(await mfd.claimableRewards('0x70997970C51812dc3A010C7d01b50e0d17dc79C8'));
	console.log(await mfd.rewardsDuration());
	console.log(await mfd.rewardsLookback());
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
