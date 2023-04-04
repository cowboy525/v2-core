import {ethers} from 'hardhat';
import {getConfigForChain} from '../config';
import HardhatDeployConfig from '../config/31337';
import {LendingPool} from '../typechain';
import fs from 'fs';

const hre = require('hardhat');
const {deployments, getNamedAccounts} = hre;

(async () => {
	let deps = await deployments.all();
	console.log();

	const {read, execute} = deployments;
	const {deployer} = await getNamedAccounts();

	const bm = await ethers.getContract('BountyManager');
	const target = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
	// const target = "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E";

	const bty = await bm.quote(target);
	console.log(bty);
})();
