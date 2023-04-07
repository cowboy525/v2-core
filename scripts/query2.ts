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
	ChefIncentivesController,
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
	const cic = <ChefIncentivesController>await ethers.getContract('ChefIncentivesController');
	const bm = <BountyManager>await ethers.getContract('BountyManager');

	let dep = await ethers.getContractAt('ERC20', '0x34d4F4459c1b529BEbE1c426F1e584151BE2C1e5');
	let bor = await ethers.getContractAt('ERC20', '0x3c84437794A5515150982A6F69DE5b3e017004a1');

	let addr = '0x23D82B00aE85657a933bfD88B764f6B270aF6F4A';

	// const ownerAddr = await read('ChefIncentivesController', 'owner');
	// console.log(`CIC Owner: ${ownerAddr}`);
	// await hre.network.provider.request({
	// 	method: 'hardhat_impersonateAccount',
	// 	params: [ownerAddr],
	// });
	// const admin = await hre.ethers.getSigner(ownerAddr);
	// await cic.connect(admin).transferOwnership(deployer);

	console.log(`dep`);
	let r = await cic.userInfo('0x34d4F4459c1b529BEbE1c426F1e584151BE2C1e5', addr);
	console.log(r);
	console.log(await dep.balanceOf(addr));

	console.log(`bor`);
	r = await cic.userInfo('0x3c84437794A5515150982A6F69DE5b3e017004a1', addr);
	console.log(r);
	console.log(await bor.balanceOf(addr));
})();
