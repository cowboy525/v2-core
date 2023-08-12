const paramData = {
	localhost: {
		rps: 4.049730982,
		aps: {
			rWBTC: 8,
			vdWBTC: 13,
			rWETH: 30,
			vdWETH: 60,
			rUSDC: 25,
			vdUSDC: 55,
			rUSDT: 5,
			vdUSDT: 13,
			rDAI: 3,
			vdDAI: 7,
			rARB: 5,
			vdARB: 4,
			rwstETH: 10,
			vdwstETH: 8,
		},
		rates: [
			[
				'WBTC',
				{
					reservesParams: {
						strategy: {
							baseVariableBorrowRate: '0',
							name: 'rateStrategyVolatileBTC',
							optimalUtilizationRate: '700000000000000000000000000',
							variableRateSlope1: '140000000000000000000000000',
							variableRateSlope2: '950000000000000000000000000',
							stableRateSlope1: '100000000000000000000000000',
							stableRateSlope2: '3000000000000000000000000000',
						},
					},
				},
			],
			[
				'USDT',
				{
					reservesParams: {
						strategy: {
							baseVariableBorrowRate: '0',
							name: 'rateStrategyStableUSDT',
							optimalUtilizationRate: '650000000000000000000000000',
							variableRateSlope1: '50000000000000000000000000',
							variableRateSlope2: '650000000000000000000000000',
							stableRateSlope1: '60000000000000000000000000',
							stableRateSlope2: '750000000000000000000000000',
						},
					},
				},
			],
			[
				'USDC',
				{
					reservesParams: {
						strategy: {
							baseVariableBorrowRate: '0',
							name: 'rateStrategyStableUSDC',
							optimalUtilizationRate: '620000000000000000000000000',
							variableRateSlope1: '60000000000000000000000000',
							variableRateSlope2: '650000000000000000000000000',
							stableRateSlope1: '60000000000000000000000000',
							stableRateSlope2: '750000000000000000000000000',
						},
					},
				},
			],
			[
				'DAI',
				{
					reservesParams: {
						strategy: {
							baseVariableBorrowRate: '0',
							name: 'rateStrategyStableDAI',
							optimalUtilizationRate: '640000000000000000000000000',
							variableRateSlope1: '60000000000000000000000000',
							variableRateSlope2: '650000000000000000000000000',
							stableRateSlope1: '60000000000000000000000000',
							stableRateSlope2: '750000000000000000000000000',
						},
					},
				},
			],
			[
				'WETH',
				{
					reservesParams: {
						strategy: {
							baseVariableBorrowRate: '0',
							name: 'rateStrategyWETH',
							optimalUtilizationRate: '700000000000000000000000000',
							variableRateSlope1: '120000000000000000000000000',
							variableRateSlope2: '950000000000000000000000000',
							stableRateSlope1: '100000000000000000000000000',
							stableRateSlope2: '3000000000000000000000000000',
						},
					},
				},
			],
			[
				'ARB',
				{
					reservesParams: {
						strategy: {
							baseVariableBorrowRate: '0',
							name: 'rateStrategyARB',
							optimalUtilizationRate: '500000000000000000000000000',
							variableRateSlope1: '150000000000000000000000000',
							variableRateSlope2: '950000000000000000000000000',
							stableRateSlope1: '100000000000000000000000000',
							stableRateSlope2: '3000000000000000000000000000',
						},
					},
				},
			],
			[
				'WSTETH',
				{
					reservesParams: {
						strategy: {
							baseVariableBorrowRate: '0',
							name: 'rateStrategyWSTETH',
							optimalUtilizationRate: '500000000000000000000000000',
							variableRateSlope1: '140000000000000000000000000',
							variableRateSlope2: '950000000000000000000000000',
							stableRateSlope1: '100000000000000000000000000',
							stableRateSlope2: '3000000000000000000000000000',
						},
					},
				},
			],
		],
		underlying: {
			WBTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
			USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
			USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
			DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
			WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
			ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',
			WSTETH: '0x5979D7b546E38E414F7E9822514be443A4800529',
		},
	},
	arbitrum: {
		aps: {
			rWBTC: 8,
			vdWBTC: 13,
			rWETH: 30,
			vdWETH: 60,
			rUSDC: 25,
			vdUSDC: 55,
			rUSDT: 5,
			vdUSDT: 13,
			rDAI: 3,
			vdDAI: 7,
			rARB: 5,
			vdARB: 4,
			rwstETH: 10,
			vdwstETH: 8,
		},
		rates: [
			[
				'WBTC',
				{
					reservesParams: {
						strategy: {
							baseVariableBorrowRate: '0',
							name: 'rateStrategyVolatileBTC',
							optimalUtilizationRate: '700000000000000000000000000',
							variableRateSlope1: '130000000000000000000000000',
							variableRateSlope2: '950000000000000000000000000',
							stableRateSlope1: '100000000000000000000000000',
							stableRateSlope2: '3000000000000000000000000000',
						},
					},
				},
			],
			[
				'USDT',
				{
					reservesParams: {
						strategy: {
							baseVariableBorrowRate: '0',
							name: 'rateStrategyStableUSDT',
							optimalUtilizationRate: '620000000000000000000000000',
							variableRateSlope1: '60000000000000000000000000',
							variableRateSlope2: '650000000000000000000000000',
							stableRateSlope1: '60000000000000000000000000',
							stableRateSlope2: '750000000000000000000000000',
						},
					},
				},
			],
			[
				'USDC',
				{
					reservesParams: {
						strategy: {
							baseVariableBorrowRate: '0',
							name: 'rateStrategyStableUSDC',
							optimalUtilizationRate: '615000000000000000000000000',
							variableRateSlope1: '60000000000000000000000000',
							variableRateSlope2: '650000000000000000000000000',
							stableRateSlope1: '60000000000000000000000000',
							stableRateSlope2: '750000000000000000000000000',
						},
					},
				},
			],
			[
				'DAI',
				{
					reservesParams: {
						strategy: {
							baseVariableBorrowRate: '0',
							name: 'rateStrategyStableDAI',
							optimalUtilizationRate: '615000000000000000000000000',
							variableRateSlope1: '60000000000000000000000000',
							variableRateSlope2: '650000000000000000000000000',
							stableRateSlope1: '60000000000000000000000000',
							stableRateSlope2: '750000000000000000000000000',
						},
					},
				},
			],
			[
				'WETH',
				{
					reservesParams: {
						strategy: {
							baseVariableBorrowRate: '0',
							name: 'rateStrategyWETH',
							optimalUtilizationRate: '700000000000000000000000000',
							variableRateSlope1: '130000000000000000000000000',
							variableRateSlope2: '950000000000000000000000000',
							stableRateSlope1: '100000000000000000000000000',
							stableRateSlope2: '3000000000000000000000000000',
						},
					},
				},
			],
			[
				'ARB',
				{
					reservesParams: {
						strategy: {
							baseVariableBorrowRate: '0',
							name: 'rateStrategyARB',
							optimalUtilizationRate: '700000000000000000000000000',
							variableRateSlope1: '130000000000000000000000000',
							variableRateSlope2: '950000000000000000000000000',
							stableRateSlope1: '100000000000000000000000000',
							stableRateSlope2: '3000000000000000000000000000',
						},
					},
				},
			],
			[
				'WSTETH',
				{
					reservesParams: {
						strategy: {
							baseVariableBorrowRate: '0',
							name: 'rateStrategyWSTETH',
							optimalUtilizationRate: '700000000000000000000000000',
							variableRateSlope1: '130000000000000000000000000',
							variableRateSlope2: '950000000000000000000000000',
							stableRateSlope1: '100000000000000000000000000',
							stableRateSlope2: '3000000000000000000000000000',
						},
					},
				},
			],
		],
		underlying: {
			WBTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
			USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
			USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
			DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
			WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
			ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',
			WSTETH: '0x5979D7b546E38E414F7E9822514be443A4800529',
		},
	},
	bsc: {
		aps: {
			rWBTC: 2,
			vdWBTC: 4,
			rWETH: 25,
			vdWETH: 25,
			rUSDC: 1,
			vdUSDC: 44,
			rUSDT: 6,
			vdUSDT: 12,
			rDAI: 4,
			vdDAI: 8,
		},
		rates: [
			[
				'BTCB',
				{
					reservesParams: {
						strategy: {
							baseVariableBorrowRate: '0',
							name: 'rateStrategyVolatileBTC',
							optimalUtilizationRate: '680000000000000000000000000',
							variableRateSlope1: '115000000000000000000000000',
							variableRateSlope2: '950000000000000000000000000',
							stableRateSlope1: '100000000000000000000000000',
							stableRateSlope2: '3000000000000000000000000000',
						},
					},
				},
			],
			[
				'BUSD',
				{
					reservesParams: {
						strategy: {
							baseVariableBorrowRate: '0',
							name: 'rateStrategyStableBUSD',
							optimalUtilizationRate: '700000000000000000000000000',
							variableRateSlope1: '75000000000000000000000000',
							variableRateSlope2: '650000000000000000000000000',
							stableRateSlope1: '60000000000000000000000000',
							stableRateSlope2: '750000000000000000000000000',
						},
					},
				},
			],
			[
				'USDC',
				{
					reservesParams: {
						strategy: {
							baseVariableBorrowRate: '0',
							name: 'rateStrategyStableUSDC',
							optimalUtilizationRate: '680000000000000000000000000',
							variableRateSlope1: '75000000000000000000000000',
							variableRateSlope2: '650000000000000000000000000',
							stableRateSlope1: '60000000000000000000000000',
							stableRateSlope2: '750000000000000000000000000',
						},
					},
				},
			],
			[
				'USDT',
				{
					reservesParams: {
						strategy: {
							baseVariableBorrowRate: '0',
							name: 'rateStrategyStableUSDT',
							optimalUtilizationRate: '680000000000000000000000000',
							variableRateSlope1: '75000000000000000000000000',
							variableRateSlope2: '650000000000000000000000000',
							stableRateSlope1: '60000000000000000000000000',
							stableRateSlope2: '750000000000000000000000000',
						},
					},
				},
			],
			[
				'WBNB',
				{
					reservesParams: {
						strategy: {
							baseVariableBorrowRate: '0',
							name: 'rateStrategyWBNB',
							optimalUtilizationRate: '650000000000000000000000000',
							variableRateSlope1: '115000000000000000000000000',
							variableRateSlope2: '950000000000000000000000000',
							stableRateSlope1: '100000000000000000000000000',
							stableRateSlope2: '3000000000000000000000000000',
						},
					},
				},
			],
			[
				'WETH',
				{
					reservesParams: {
						strategy: {
							baseVariableBorrowRate: '0',
							name: 'rateStrategyWETH',
							optimalUtilizationRate: '650000000000000000000000000',
							variableRateSlope1: '115000000000000000000000000',
							variableRateSlope2: '950000000000000000000000000',
							stableRateSlope1: '100000000000000000000000000',
							stableRateSlope2: '3000000000000000000000000000',
						},
					},
				},
			],
		],
		underlying: {
			BTCB: '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c',
			USDT: '0x55d398326f99059ff775485246999027b3197955',
			BUSD: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
			USDC: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
			WETH: '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
			WBNB: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
		},
	},
};
export default paramData;
