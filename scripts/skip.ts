import * as dotenv from 'dotenv';

import {ethers} from 'hardhat';
import {advanceTimeAndBlock, depositAndBorrowAll, zapIntoEligibility} from '../test/shared/helpers';
import {DAY, HOUR, MINUTE} from '../config/constants';

dotenv.config();

async function main() {
	const {chainId} = await ethers.provider.getNetwork();
	console.log('Chain Id:', chainId);
	await advanceTimeAndBlock(30 * DAY);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
