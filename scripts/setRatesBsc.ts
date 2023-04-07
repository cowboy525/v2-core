import {ethers} from 'hardhat';
import fs from 'fs';

async function main() {
	let addressProvider = await hre.ethers.getContract('LendingPoolAddressesProvider');

	let currentAdmin = await addressProvider.getPoolAdmin();
	console.log(`hereere`);
	console.log(currentAdmin);

	let impersonate = false;
	let admin;
	if (impersonate) {
		// const signer2 = await hre.ethers.getSigner('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
		// const tx = await signer2.sendTransaction({
		// 	to: admin,
		// 	value: hre.ethers.utils.parseEther('1.0'),
		// });
		await hre.network.provider.request({
			method: 'hardhat_impersonateAccount',
			params: [currentAdmin],
		});
		admin = await hre.ethers.getSigner(currentAdmin);
	} else {
		admin = (await ethers.getSigners())[0];
	}

	console.log('Admin:', admin.address);
	console.log('Balance:', ethers.utils.formatEther(await admin.getBalance()));

	const TOKENS_CONFIG = new Map([
		[
			'BTCB',
			{
				reservesParams: {
					strategy: {
						baseVariableBorrowRate: '0',
						name: 'rateStrategyVolatileBTC',
						optimalUtilizationRate: '670000000000000000000000000',
						variableRateSlope1: '125000000000000000000000000',
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
						optimalUtilizationRate: '670000000000000000000000000',
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
						optimalUtilizationRate: '670000000000000000000000000',
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
						name: 'rateStrategyBNB',
						optimalUtilizationRate: '625000000000000000000000000',
						variableRateSlope1: '125000000000000000000000000',
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
						variableRateSlope1: '125000000000000000000000000',
						variableRateSlope2: '950000000000000000000000000',
						stableRateSlope1: '100000000000000000000000000',
						stableRateSlope2: '3000000000000000000000000000',
					},
				},
			},
		],
	]);

	const strategyAddresses = new Map();

	for (const [key, value] of TOKENS_CONFIG) {
		const strategyName = value.reservesParams.strategy.name;
		if (!strategyAddresses.has(strategyName)) {
			const DefaultReserveInterestRateStrategy = await ethers.getContractFactory(
				'DefaultReserveInterestRateStrategy'
			);
			console.log(`depoying new strat`);
			console.log(`---`);

			const defaultReserveInterestRateStrategy = await DefaultReserveInterestRateStrategy.deploy(
				addressProvider.address,
				value.reservesParams.strategy.optimalUtilizationRate,
				value.reservesParams.strategy.baseVariableBorrowRate,
				value.reservesParams.strategy.variableRateSlope1,
				value.reservesParams.strategy.variableRateSlope2,
				value.reservesParams.strategy.stableRateSlope1,
				value.reservesParams.strategy.variableRateSlope2
			);
			await defaultReserveInterestRateStrategy.deployed();
			console.log(`${strategyName}:`, defaultReserveInterestRateStrategy.address);
			strategyAddresses.set(strategyName, defaultReserveInterestRateStrategy.address);
		}
	}

	console.log(strategyAddresses);

	//   let confiugurator = await ethers.getContractFactory("LendingPoolConfigurator");

	//   const lendingPoolConfiguratorProxy = LendingPoolConfiguratorImpl.attach(
	//     await lendingPoolAddressesProvider.getLendingPoolConfigurator()
	// );
	// console.log("LendingPoolConfigurator:", lendingPoolConfiguratorProxy.address);

	// const addressProvider = await ethers.getContractAt(
	// 	'LendingPoolAddressesProvider',
	// 	data.lendingPoolAddressesProvider
	// );

	let configuratorAddr = await addressProvider.getLendingPoolConfigurator();

	console.log(`configuratorAddr:`);
	console.log(configuratorAddr);

	const configurator = await ethers.getContractAt('LendingPoolConfigurator', configuratorAddr);

	interface Foo {
		[key: string]: string;
	}

	let addrs: Foo = {
		BTCB: '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c',
		USDT: '0x55d398326f99059ff775485246999027b3197955',
		BUSD: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
		USDC: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
		WETH: '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
		WBNB: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
	};

	for (const [key, value] of Object.entries(addrs)) {
		// console.log(`${key}: ${value}`);
		let assetDetails = TOKENS_CONFIG.get(key);
		// console.log(assetDetails);
		let stratName = assetDetails?.reservesParams.strategy.name;
		let stratAddr = strategyAddresses.get(stratName);
		let underlyingAddr = addrs[key];
		console.log(' ');
		console.log(key);
		console.log(stratName);
		console.log(underlyingAddr);
		console.log(stratAddr);
		console.log(' ');

		let wow = await configurator.connect(admin).setReserveInterestRateStrategyAddress(underlyingAddr, stratAddr);
		console.log(`nice`);
		console.log(wow.hash);
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
