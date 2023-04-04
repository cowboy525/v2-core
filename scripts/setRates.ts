import {ethers} from 'hardhat';
import fs from 'fs';

async function main() {
	let addressProvider = await hre.ethers.getContract('LendingPoolAddressesProvider');

	let currentAdmin = await addressProvider.getPoolAdmin();
	console.log(`hereere`);
	console.log(currentAdmin);

	// const signer2 = await hre.ethers.getSigner('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
	// const tx = await signer2.sendTransaction({
	// 	to: admin,
	// 	value: hre.ethers.utils.parseEther('1.0'),
	// });

	let impersonate = false;
	let admin;
	if (impersonate) {
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
		WBTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
		USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
		USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
		DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
		WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
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
