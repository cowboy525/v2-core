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
} from '../typechain';

const hre = require('hardhat');
const {deployments, getNamedAccounts} = hre;

(async () => {
	const {execute, deploy, read} = deployments;
	const {deployer} = await getNamedAccounts();
	let amt = ethers.utils.parseEther('1000000');
	const mfd = <MultiFeeDistribution>await ethers.getContract('MFD');
	const middle = <MiddleFeeDistribution>await ethers.getContract('MiddleFeeDistribution');
	const bm = <BountyManager>await ethers.getContract('BountyManager');

	await bm.setMinStakeAmount(0);

	// console.log(await mfd.claimableRewards('0x70997970C51812dc3A010C7d01b50e0d17dc79C8'));
	// console.log(await mfd.rewardData('0x775Bc80658656D0845041EA13BBEA5f0CEa8E792'));

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
