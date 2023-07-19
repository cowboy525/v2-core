import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {BigNumber} from 'ethers';
import {
	BountyManager,
	ChefIncentivesController,
	EligibilityDataProvider,
	LendingPool,
	Leverager,
	LockZap,
	MiddleFeeDistribution,
	MockToken,
	MultiFeeDistribution,
	PriceProvider,
	RadiantOFT,
	UniV2TwapOracle,
	WETH,
	WETHGateway,
} from '../../typechain';

export interface DeployConfig {
	NETWORK: string;
	CHAIN_ID: number;
	SYMBOL: string;
	TOKEN_NAME: string;

	MINT_AMT: BigNumber;
	SUPPLY_CIC_RESERVE: BigNumber;
	SUPPLY_MIGRATION_MINT?: BigNumber;
	SUPPLY_DQ_RESERVE: BigNumber;
	LP_PROVIDER: LP_PROVIDER;
	LP_INIT_ETH: BigNumber;
	LP_INIT_RDNT: BigNumber;

	STARGATE_MAX_SLIPPAGE: string;
	FEE_LOOPING: string;
	FEE_XCHAIN_BORROW: string;
	FEE_BRIDGING: string;

	CIC_RPS: BigNumber;
	MFD_REWARD_DURATION_SECS: string;
	MFD_REWARD_LOOKBACK_SECS: string;
	MFD_LOCK_DURATION_SECS: string;
	MFD_VEST_DURATION: number;

	STARFLEET_RATIO: string;
	MIN_STAKE_AMT: BigNumber;
	DQ_TARGET_BASE_BOUNTY_USD: BigNumber;
	DQ_MAX_BASE_BOUNTY: BigNumber;
	DQ_BOOSTER: BigNumber;
	DQ_HUNTER_SHARE: number;
	TWAP_PERIOD: number;
	AC_THRESHOLD: BigNumber;
	AC_FEE: number;
	AC_SLIPPAGE_LIMIT: number;
	ZAP_SLIPPAGE_LIMIT: number;
	OPEX_RATIO: string;
	P2P_RATIO: string;

	RADIANT_V1?: string;

	WETH: string;
	ROUTER_ADDR: string;
	BAL_WEIGHTED_POOL_FACTORY?: string;
	BAL_VAULT?: string;
	STARGATE_ROUTER: string;
	STARGATE_ROUTER_ETH?: string;
	LZ_ENDPOINT: string;
	CHAINLINK_ETH_USD_AGGREGATOR_PROXY: string;

	LEVERAGER_ZAP_MARGIN: string;
	TOKENS_CONFIG: any[];
	STARGATE_CONFIG: {
		ASSETS: string[];
		POOL_IDS: number[];
	};
	LOCK_INFO: {LOCK_PERIOD: number[]; MULTIPLIER: number[]};
}

export interface DeployData {
	radiantV1: string;
	lendingPool: any;
	lendingPoolAddressesProvider: string;
	lendingPoolAddressesProviderRegistry: string;
	wethGateway: string;
	rdntToken: string;
	walletBalanceProvider: string;
	uiPoolDataProvider: string;
	aaveProtocolDataProvider: string;
	multicall: string;
	middleFeeDistribution: string;
	multiFeeDistribution: string;
	chefIncentivesController: string;
	eligibilityDataProvider: string;
	stableAndVariableTokensHelper: string;
	aTokensAndRatesHelper: string;
	aaveOracle: string;
	lendingRateOracle: string;
	allTokens: any;
	allTokenAddrs: any;
	leverager: any;
	stargateRouter: any;
	stargateBorrow: any;
	timelock: any;
	lpLockerList: any;
	bountyManager: string;
	uniV2TwapOracle: string;
	stakingToken: any;
	daoTreasury: any;
	priceProvider: any;
	baseAssetWrappedAddress: any;
	lendingPoolAddressProvider: any;
	migration: string;
	lockZap: string;
	poolHelper: string;
}

export interface GraphData {
	network: string;
	multi_fee_distribution_address: string;
	lp_fee_distribution_address: string;
	chef_incentives_controller_address: string;
	mfd_stats_address: string;
	multi_fee_distribution_start_block: number;
	lp_fee_distribution_start_block: number;
	chef_incentives_controller_start_block: number;
	mfd_stats_start_block: number;
}

export interface DeployAddresses {
	staking?: any;
	deployer: string;
	treasury: string;
	dao: string;
	eco: string;
	team: string;
}

export enum LP_PROVIDER {
	BALANCER,
	UNISWAP,
}

export interface DeployConfigOverride {
	CHAIN_ID?: number;
	NETWORK?: string;
	TESTNET?: boolean;
	DEPLOY_WETH?: boolean;
	SUPPLY_CIC_RESERVE?: BigNumber;
	SUPPLY_MAX_MINT?: BigNumber;
	SUPPLY_LP_MINT?: BigNumber;
	SUPPLY_TEAM_MINT?: BigNumber;
	SUPPLY_TEAM_VEST?: BigNumber;
	SUPPLY_ECO_MINT?: BigNumber;
	SUPPLY_MIGRATION_MINT?: BigNumber;
	SUPPLY_DQ_RESERVE?: BigNumber;
	FEE_LOOPING?: string;
	FEE_XCHAIN_BORROW?: string;
	FEE_BRIDGING?: string;
	LP_INIT_ETH?: BigNumber;
	LP_INIT_RDNT?: BigNumber;
	CIC_RPS?: BigNumber;
	MFD_REWARD_DURATION_SECS?: string;
	MFD_REWARD_LOOKBACK_SECS?: string;
	MFD_LOCK_DURATION_SECS?: string;
	STARFLEET_RATIO?: string;
	DQ_PRUNE_LIMIT?: number;
	MIN_STAKE_AMT?: BigNumber;
	DQ_TARGET_BASE_BOUNTY_USD?: BigNumber;
	DQ_BOOSTER?: BigNumber;
	DQ_HUNTER_SHARE?: number;
	DQ_TREASURY?: string;
	OPEX_RATIO?: string;
	MFD_VEST_DURATION?: number;
	RADIANT_V1?: string;
	P2P_RATIO?: string;
	MIGRATE_EXCHANGE_RATIO?: string;
	LP_PROVIDER?: LP_PROVIDER;
	ROUTER_ADDR?: string;
	BAL_WEIGHTED_POOL_FACTORY?: string;
	BAL_VAULT?: string;
	DAO?: string;
	TREASURY?: string;
	TEAM_RECEIVER?: string;
	LP_RECEIVER?: string;
	TIMELOCK_ADMIN?: string;
	EMERGENCY_ADMIN?: string;
	TIMELOCK_DELAY?: number;
	DEPLOY_DELAY?: number;

	STARGATE_ROUTER?: string;
	SUSHI_ROUTER?: string;
	WETH_ADDRESS?: string;
	LZ_ENDPOINT?: string;
	CHAINLINK_ETH_USD_AGGREGATOR_PROXY?: string;

	TOKENS_CONFIG?: any[];
	STARGATE_CONFIG?: {
		ASSETS: string[];
		POOL_IDS: number[];
	};
}

export interface FixtureDeploy {
	deployer: SignerWithAddress;
	dao: SignerWithAddress;
	treasury: SignerWithAddress;
	team: SignerWithAddress;
	eco: SignerWithAddress;
	user1: SignerWithAddress;
	user2: SignerWithAddress;
	user3: SignerWithAddress;
	user4: SignerWithAddress;

	lendingPool: LendingPool;
	chefIncentivesController: ChefIncentivesController;
	multiFeeDistribution: MultiFeeDistribution;
	middleFeeDistribution: MiddleFeeDistribution;
	rdntToken: RadiantOFT;
	bountyManager: BountyManager;
	lockZap: LockZap;
	priceProvider: PriceProvider;
	eligibilityProvider: EligibilityDataProvider;
	uniV2TwapOracle: UniV2TwapOracle;
	leverager: Leverager;
	wethGateway: WETHGateway;
	usdc: MockToken;
	weth: WETH;

	LOCK_DURATION: number;
	REWARDS_DURATION: number;
	deployData: DeployData;
	deployConfig: DeployConfig;
}
