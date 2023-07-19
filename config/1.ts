import {DeployConfig} from '../scripts/deploy/types';
import BaseConfig from './BaseConfig';

const chainConfig = {
	NETWORK: 'mainnet',
	CHAIN_ID: 1,

	// TODO: real vals
	WETH: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
	ROUTER_ADDR: '0x1b02da8cb0d097eb8d57a175b88c7d8b47997506',
	BAL_WEIGHTED_POOL_FACTORY: '0xf1665E19bc105BE4EDD3739F88315cC699cc5b65',
	BAL_VAULT: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
	STARGATE_ROUTER: '0x53Bf833A5d6c4ddA888F69c22C88C9f356a41614',
	STARGATE_ROUTER_ETH: '0xbf22f0f184bCcbeA268dF387a49fF5238dD23E40',
	LZ_ENDPOINT: '0x3c2269811836af69497E5F486A85D7316753cf62',
	CHAINLINK_ETH_USD_AGGREGATOR_PROXY: '0x639fe6ab55c921f74e7fac1ee960c0b6293ba612',
	STARGATE_CONFIG: {
		ASSETS: [
			'0xCb2A18E5328Daf9eeF62C6D2DF415a27D7118b23',
			'0xa43A5FD4a2ce19B5fFcf00065FcC877392C326bf',
			'0x479df35c7EDa9AE8B2086F54b6c42115D8a971D9',
		],
		POOL_IDS: [1, 2, 3],
	},
	TOKENS_CONFIG: [
		[
			'USDC',
			{
				assetAddress: '0xCb2A18E5328Daf9eeF62C6D2DF415a27D7118b23',
				chainlinkAggregator: '0xAb5c49580294Aff77670F839ea425f5b78ab3Ae7',
				borrowRate: '39000000000000000000000000',
				reservesParams: {
					aTokenImpl: 'AToken',
					baseLTVAsCollateral: '8000',
					borrowingEnabled: true,
					liquidationBonus: '11500',
					liquidationThreshold: '8500',
					reserveDecimals: '6',
					reserveFactor: BaseConfig.RESERVE_FACTOR,
					stableBorrowRateEnabled: false,
					strategy: {
						baseVariableBorrowRate: '0',
						name: 'rateStrategyStableThree',
						optimalUtilizationRate: '900000000000000000000000000',
						variableRateSlope1: '40000000000000000000000000',
						variableRateSlope2: '600000000000000000000000000',
						stableRateSlope1: '20000000000000000000000000',
						stableRateSlope2: '600000000000000000000000000',
					},
				},
				initInputParams: {
					aTokenImpl: '0x0000000000000000000000000000000000000000',
					aTokenName: 'Radiant interest bearing USDC',
					aTokenSymbol: 'rUSDC',
					incentivesController: '0x0000000000000000000000000000000000000000',
					interestRateStrategyAddress: '0x0000000000000000000000000000000000000000',
					params: '0x10',
					stableDebtTokenImpl: '0x0000000000000000000000000000000000000000',
					stableDebtTokenName: 'Radiant stable debt bearing USDC',
					stableDebtTokenSymbol: 'stableDebtUSDC',
					treasury: '0x0000000000000000000000000000000000000000',
					underlyingAsset: '0xCb2A18E5328Daf9eeF62C6D2DF415a27D7118b23',
					underlyingAssetDecimals: '6',
					underlyingAssetName: 'USDC',
					variableDebtTokenImpl: '0x0000000000000000000000000000000000000000',
					variableDebtTokenName: 'Radiant variable debt bearing USDC',
					variableDebtTokenSymbol: 'variableDebtUSDC',
					allocPoint: 100,
				},
			},
		],

		[
			'WETH',
			{
				assetAddress: '0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
				chainlinkAggregator: '0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e',
				borrowRate: '30000000000000000000000000',
				reservesParams: {
					aTokenImpl: 'AToken',
					baseLTVAsCollateral: '8000',
					borrowingEnabled: true,
					liquidationBonus: '11500',
					liquidationThreshold: '8250',
					reserveDecimals: '18',
					reserveFactor: BaseConfig.RESERVE_FACTOR,
					stableBorrowRateEnabled: false,
					strategy: {
						baseVariableBorrowRate: '0',
						name: 'rateStrategyWETH',
						optimalUtilizationRate: '650000000000000000000000000',
						variableRateSlope1: '80000000000000000000000000',
						variableRateSlope2: '1000000000000000000000000000',
						stableRateSlope1: '100000000000000000000000000',
						stableRateSlope2: '1000000000000000000000000000',
					},
				},
				initInputParams: {
					aTokenImpl: '0x0000000000000000000000000000000000000000',
					aTokenName: 'Radiant interest bearing WETH',
					aTokenSymbol: 'rWETH',
					incentivesController: '0x0000000000000000000000000000000000000000',
					interestRateStrategyAddress: '0x0000000000000000000000000000000000000000',
					params: '0x10',
					stableDebtTokenImpl: '0x0000000000000000000000000000000000000000',
					stableDebtTokenName: 'Radiant stable debt bearing WETH',
					stableDebtTokenSymbol: 'stableDebtWETH',
					treasury: '0x0000000000000000000000000000000000000000',
					underlyingAsset: '0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6',
					underlyingAssetDecimals: '18',
					underlyingAssetName: 'WETH',
					variableDebtTokenImpl: '0x0000000000000000000000000000000000000000',
					variableDebtTokenName: 'Radiant variable debt bearing WETH',
					variableDebtTokenSymbol: 'variableDebtWETH',
					allocPoint: 100,
				},
			},
		],
	],
};

const MainnetConfig: DeployConfig = {...BaseConfig, ...chainConfig};
export default MainnetConfig;
