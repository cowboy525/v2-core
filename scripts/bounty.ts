import {ethers} from 'hardhat';
import {getConfigForChain} from '../config';
import HardhatDeployConfig from '../config/31337';
import {LendingPool} from '../typechain';
import fs from 'fs';

const hre = require('hardhat');

(async () => {
	const bm = await ethers.getContract('BountyManager');
	const target = '';

	const bty = await bm.quote(target);
	console.log(bty);
})();
