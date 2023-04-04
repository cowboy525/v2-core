import {ethers} from 'hardhat';
import {DAY, HOUR, MINUTE} from './constants';

const LOCK_TIME: number = 30 * DAY;
const VEST_TIME: number = 90 * DAY;
const REWARDS_DURATION = 7 * DAY;
const LOOKBACK_DURATION = 1 * DAY;

const BaseConfig = {
	TOKEN_NAME: 'Radiant',
	SYMBOL: 'RDNT',

	LOCK_INFO: {
		LOCK_PERIOD: [LOCK_TIME, LOCK_TIME * 3, LOCK_TIME * 6, LOCK_TIME * 12],
		MULTIPLIER: [1, 4, 10, 25],
	},

	RESERVE_FACTOR: '7500',
	FEE_LOOPING: '0',
	FEE_XCHAIN_BORROW: '10',
	FEE_BRIDGING: '0', //10000
	OPEX_RATIO: '0',
	// OPEX_RATIO: '2000',
	P2P_RATIO: '500', //10000
	DQ_HUNTER_SHARE: 3000, //10000
	AC_FEE: 3, //10
	minStakeAmount: ethers.utils.parseEther('5'),
	STARFLEET_RATIO: '10000', // / 100000
	MFD_VEST_DURATION: VEST_TIME,

	MIGRATE_EXCHANGE_RATIO: '1000',
	slippageLimit: 10,
	TWAP_PERIOD: 10,
	AC_SLIPPAGE_LIMIT: 9000,
	ZAP_SLIPPAGE_LIMIT: 9000,
	AC_THRESHOLD: ethers.utils.parseEther('5'),
	MFD_LP_RATIO: '10000',
	MFD_REWARD_DURATION_SECS: REWARDS_DURATION.toString(),
	MFD_REWARD_LOOKBACK_SECS: LOOKBACK_DURATION.toString(),
	MFD_LOCK_DURATION_SECS: (LOCK_TIME * 3).toString(),
};

export default BaseConfig;
