import {ethers} from 'hardhat';
import {TestnetLockZap} from '../typechain';

const hre = require('hardhat');
const {deployments, getNamedAccounts} = hre;

(async () => {
	const {execute} = deployments;
	const {deployer} = await getNamedAccounts();
	let amt = ethers.utils.parseEther('1000000');
	const lz = <TestnetLockZap>await ethers.getContract('LockZap');

	await execute('RadiantOFT', {from: deployer, log: true}, 'approve', lz.address, ethers.constants.MaxUint256);
	await execute('LockZap', {from: deployer, log: true}, 'sell', amt);
})();
