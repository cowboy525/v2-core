const paramData = {
	arbitrum: {
		rps: 4.049730982,
		aps: {
			rDAI: 3,
			vdDAI: 7,
			rUSDC: 25,
			vdUSDC: 55,
			rUSDT: 5,
			vdUSDT: 13,
			rWETH: 30,
			vdWETH: 60,
			rARB: 5,
			vdARB: 4,
			rwstETH: 10,
			vdwstETH: 8,
			rWBTC: 8,
			vdWBTC: 13,
		},
		rates: [
			[
				'DAI',
				{
					name: 'rateStrategyStableDAI',
					optimalUtilizationRate: 0.64,
					variableRateSlope1: 0.06,
					variableRateSlope2: 0.65,
				},
			],
			[
				'USDC',
				{
					name: 'rateStrategyStableUSDC',
					optimalUtilizationRate: 0.62,
					variableRateSlope1: 0.06,
					variableRateSlope2: 0.65,
				},
			],
			[
				'USDT',
				{
					name: 'rateStrategyStableUSDT',
					optimalUtilizationRate: 0.65,
					variableRateSlope1: 0.05,
					variableRateSlope2: 0.65,
				},
			],
			[
				'WETH',
				{
					name: 'rateStrategyWETH',
					optimalUtilizationRate: 0.7,
					variableRateSlope1: 0.12,
					variableRateSlope2: 0.95,
				},
			],
			[
				'ARB',
				{
					name: 'rateStrategyARB',
					optimalUtilizationRate: 0.5,
					variableRateSlope1: 0.15,
					variableRateSlope2: 0.95,
				},
			],
			[
				'WSTETH',
				{
					name: 'rateStrategyWSTETH',
					optimalUtilizationRate: 0.5,
					variableRateSlope1: 0.14,
					variableRateSlope2: 0.95,
				},
			],
			[
				'WBTC',
				{
					name: 'rateStrategyVolatileBTC',
					optimalUtilizationRate: 0.7,
					variableRateSlope1: 0.14,
					variableRateSlope2: 0.95,
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
		rps: 2.652320636,
		aps: {
			rBTCB: 25,
			vdBTCB: 50,
			rBUSD: 4,
			vdBUSD: 8,
			rUSDC: 2,
			vdUSDC: 4,
			rUSDT: 20,
			vdUSDT: 50,
			rWBNB: 40,
			vdWBNB: 80,
			rWETH: 4,
			vdWETH: 7,
		},
		rates: [
			[
				'BTCB',
				{
					name: 'rateStrategyBTCB',
					optimalUtilizationRate: 0.7,
					variableRateSlope1: 0.11,
					variableRateSlope2: 0.95,
				},
			],
			[
				'BUSD',
				{
					name: 'rateStrategyStableBUSD',
					optimalUtilizationRate: 0.73,
					variableRateSlope1: 0.07,
					variableRateSlope2: 0.65,
				},
			],
			[
				'USDC',
				{
					name: 'rateStrategyStableUSDC',
					optimalUtilizationRate: 0.69,
					variableRateSlope1: 0.07,
					variableRateSlope2: 0.65,
				},
			],
			[
				'USDT',
				{
					name: 'rateStrategyStableUSDT',
					optimalUtilizationRate: 0.71,
					variableRateSlope1: 0.07,
					variableRateSlope2: 0.65,
				},
			],
			[
				'WBNB',
				{
					name: 'rateStrategyWBNB',
					optimalUtilizationRate: 0.62,
					variableRateSlope1: 0.11,
					variableRateSlope2: 0.95,
				},
			],
			[
				'WETH',
				{
					name: 'rateStrategyWETH',
					optimalUtilizationRate: 0.65,
					variableRateSlope1: 0.1,
					variableRateSlope2: 0.95,
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

	localhost: {
		rps: 4.049730982,
		aps: {
			rDAI: 3,
			vdDAI: 7,
			rUSDC: 25,
			vdUSDC: 55,
			rUSDT: 5,
			vdUSDT: 13,
			rWETH: 30,
			vdWETH: 60,
			rARB: 5,
			vdARB: 4,
			rwstETH: 10,
			vdwstETH: 8,
			rWBTC: 8,
			vdWBTC: 13,
		},
		rates: [
			[
				'DAI',
				{
					name: 'rateStrategyStableDAI',
					optimalUtilizationRate: 0.64,
					variableRateSlope1: 0.06,
					variableRateSlope2: 0.65,
				},
			],
			[
				'USDC',
				{
					name: 'rateStrategyStableUSDC',
					optimalUtilizationRate: 0.62,
					variableRateSlope1: 0.06,
					variableRateSlope2: 0.65,
				},
			],
			[
				'USDT',
				{
					name: 'rateStrategyStableUSDT',
					optimalUtilizationRate: 0.65,
					variableRateSlope1: 0.05,
					variableRateSlope2: 0.65,
				},
			],
			[
				'WETH',
				{
					name: 'rateStrategyWETH',
					optimalUtilizationRate: 0.7,
					variableRateSlope1: 0.12,
					variableRateSlope2: 0.95,
				},
			],
			[
				'ARB',
				{
					name: 'rateStrategyARB',
					optimalUtilizationRate: 0.5,
					variableRateSlope1: 0.15,
					variableRateSlope2: 0.95,
				},
			],
			[
				'WSTETH',
				{
					name: 'rateStrategyWSTETH',
					optimalUtilizationRate: 0.5,
					variableRateSlope1: 0.14,
					variableRateSlope2: 0.95,
				},
			],
			[
				'WBTC',
				{
					name: 'rateStrategyVolatileBTC',
					optimalUtilizationRate: 0.7,
					variableRateSlope1: 0.14,
					variableRateSlope2: 0.95,
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
};
export default paramData;
