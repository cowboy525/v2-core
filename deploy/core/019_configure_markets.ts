import {ethers} from 'hardhat';
import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'configure_markets',
	tags: ['core'],
	dependencies: ['deploy_cic', 'lending'],
	runOnce: true,
});
let func = step.setFunction(async function () {
	const {config, execute, deploy, read, get, deployer} = step;

	const middleFeeDistribution = await get(`MiddleFeeDistribution`);
	const lendingPoolAddressesProvider = await get(`LendingPoolAddressesProvider`);
	const aToken = await get(`AToken`);
	const stableDebtToken = await get(`StableDebtToken`);
	const variableDebtToken = await get(`VariableDebtToken`);
	const lendingPool = await get(`LendingPool`);
	const chefIncentivesController = await get(`ChefIncentivesController`);
	const LendingPoolConfiguratorImpl = await ethers.getContractFactory('LendingPoolConfigurator');
	const lendingPoolConfiguratorProxy = LendingPoolConfiguratorImpl.attach(
		await read('LendingPoolAddressesProvider', 'getLendingPoolConfigurator')
	);
	const lendingPoolConfigurator = await read('LendingPoolAddressesProvider', 'getLendingPoolConfigurator');
	await deploy('ATokensAndRatesHelper', {
		args: [lendingPool.address, lendingPoolAddressesProvider.address, lendingPoolConfigurator],
	});

	let newStratDeployed = false;
	const strategyAddresses = new Map();
	let enhancedTokensConfig = new Map<string, any>(config.TOKENS_CONFIG);
	for (const [key, value] of enhancedTokensConfig) {
		const strategyName = value.reservesParams.strategy.name;

		if (!strategyAddresses.has(strategyName)) {
			let strat = await deploy(strategyName, {
				contract: 'DefaultReserveInterestRateStrategy',
				args: [
					lendingPoolAddressesProvider.address,
					value.reservesParams.strategy.optimalUtilizationRate,
					value.reservesParams.strategy.baseVariableBorrowRate,
					value.reservesParams.strategy.variableRateSlope1,
					value.reservesParams.strategy.variableRateSlope2,
					value.reservesParams.strategy.stableRateSlope1,
					value.reservesParams.strategy.variableRateSlope2,
				],
			});
			newStratDeployed = true;
			strategyAddresses.set(strategyName, strat.address);
		}

		let assetName = value.initInputParams.underlyingAssetName;

		let token, agg;
		if (network.tags.mocks) {
			token = (await deployments.get(key)).address;
			agg = (await deployments.get(`${key}Aggregator`)).address;
		} else {
			token = value.assetAddress;
			agg = value.chainlinkAggregator;
		}

		// Update config
		enhancedTokensConfig.set(key, {
			...(enhancedTokensConfig.get(key) as any),

			chainlinkAggregator: agg,
			assetAddress: token,
			initInputParams: {
				...(enhancedTokensConfig.get(key) as any).initInputParams,
				interestRateStrategyAddress: strategyAddresses.get(value.reservesParams.strategy.name),
				aTokenImpl: aToken.address,
				stableDebtTokenImpl: stableDebtToken.address,
				variableDebtTokenImpl: variableDebtToken.address,
				treasury: middleFeeDistribution.address,
				incentivesController: chefIncentivesController.address,
				underlyingAsset: token,
			},
		});
	}

	let currentAdmin = await read('MiddleFeeDistribution', 'admin');
	if (currentAdmin === deployer) {
		await execute('MiddleFeeDistribution', 'setAdmin', lendingPoolConfiguratorProxy.address);

		const inits = Array.from(enhancedTokensConfig.values()).map((value: any) => value.initInputParams);

		// await execute("LendingPoolConfigurator", { from: deployer }, "batchInitReserve", inits);
		await (await lendingPoolConfiguratorProxy.batchInitReserve(inits)).wait();

		// configureReserves
		const inputParams = [];
		for (const [key, value] of enhancedTokensConfig) {
			const tokenAddress = enhancedTokensConfig.get(key)!.assetAddress;
			const {
				baseLTVAsCollateral,
				liquidationBonus,
				liquidationThreshold,
				reserveFactor,
				stableBorrowRateEnabled,
				borrowingEnabled,
			} = value.reservesParams;

			if (baseLTVAsCollateral === '-1') continue;

			inputParams.push({
				asset: tokenAddress,
				baseLTV: baseLTVAsCollateral,
				liquidationThreshold: liquidationThreshold,
				liquidationBonus: liquidationBonus,
				reserveFactor: reserveFactor,
				stableBorrowingEnabled: stableBorrowRateEnabled,
				borrowingEnabled: borrowingEnabled,
			});
		}
		const aTokensAndRatesHelper = await get('ATokensAndRatesHelper');
		const aaveProtocolDataProvider = await get('AaveProtocolDataProvider');
		await execute('LendingPoolAddressesProvider', 'setPoolAdmin', aTokensAndRatesHelper.address);

		await execute('ATokensAndRatesHelper', 'configureReserves', inputParams);

		// Set deployer back as admin
		await execute('LendingPoolAddressesProvider', 'setPoolAdmin', deployer);

		let collatManager = await deploy('LendingPoolCollateralManager');

		await execute('LendingPoolAddressesProvider', 'setLendingPoolCollateralManager', collatManager.address);

		await execute(
			'LendingPoolAddressesProvider',
			'setAddress',
			'0x0100000000000000000000000000000000000000000000000000000000000000',
			aaveProtocolDataProvider.address
		);
	}
});
export default func;
