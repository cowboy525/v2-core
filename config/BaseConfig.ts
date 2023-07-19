import {ethers} from 'hardhat';
import {getInitLpAmts} from '../scripts/deploy/helpers/getInitLpAmts';
import {LP_PROVIDER} from '../scripts/deploy/types';
import {DAY, HOUR, MINUTE} from './constants';

const LOCK_TIME: number = 30 * DAY;
const VEST_TIME: number = 90 * DAY;
const REWARDS_DURATION = 7 * DAY;
const LOOKBACK_DURATION = 1 * DAY;

const LP_PLATFORM = LP_PROVIDER.UNISWAP;
const LP_INIT_ETH = 5000;
export const targetPrice = 0.41;
export const ethPrice = 2100;
const LP_INIT_RDNT = getInitLpAmts(LP_PLATFORM, LP_INIT_ETH, ethPrice, targetPrice);

const BaseConfig = {
	TOKEN_NAME: 'Radiant',
	SYMBOL: 'RDNT',

	MINT_AMT: ethers.utils.parseUnits('1000000000', 18),
	SUPPLY_CIC_RESERVE: ethers.utils.parseUnits('20000000', 18),
	SUPPLY_MIGRATION_MINT: ethers.utils.parseUnits('10000000', 18),
	SUPPLY_DQ_RESERVE: ethers.utils.parseUnits('100000', 18),

	LP_PROVIDER: LP_PLATFORM,
	LP_INIT_ETH: ethers.utils.parseUnits(LP_INIT_ETH.toString(), 18),
	LP_INIT_RDNT: ethers.utils.parseUnits(LP_INIT_RDNT.toString(), 18),

	LOCK_INFO: {
		LOCK_PERIOD: [LOCK_TIME, LOCK_TIME * 3, LOCK_TIME * 6, LOCK_TIME * 12],
		MULTIPLIER: [1, 4, 10, 25],
	},

	STARGATE_MAX_SLIPPAGE: '99',
	FEE_LOOPING: '0',
	FEE_XCHAIN_BORROW: '10',
	FEE_BRIDGING: '0', //10000

	CIC_RPS: ethers.utils.parseUnits('.1', 18),
	MFD_VEST_DURATION: VEST_TIME,
	MFD_LOCK_DURATION_SECS: (3 * LOCK_TIME).toString(),
	MFD_LP_RATIO: '10000',
	MFD_REWARD_DURATION_SECS: REWARDS_DURATION.toString(),
	MFD_REWARD_LOOKBACK_SECS: LOOKBACK_DURATION.toString(),

	STARFLEET_RATIO: '10000', // / 100000
	MIN_STAKE_AMT: ethers.utils.parseEther('5'),

	DQ_TARGET_BASE_BOUNTY_USD: ethers.utils.parseUnits('1', 18),
	DQ_BOOSTER: ethers.utils.parseUnits('0', 18),
	DQ_MAX_BASE_BOUNTY: ethers.utils.parseUnits('100', 18),
	DQ_HUNTER_SHARE: 3000, //10000
	TWAP_PERIOD: 60,
	AC_THRESHOLD: ethers.utils.parseEther('5'),
	AC_FEE: 3, //10

	AC_SLIPPAGE_LIMIT: 9000,
	ZAP_SLIPPAGE_LIMIT: 9500,

	LEVERAGER_ZAP_MARGIN: '6',
	RESERVE_FACTOR: '7500',
	OPEX_RATIO: '2000',
	P2P_RATIO: '500', //10000
};

export default BaseConfig;
