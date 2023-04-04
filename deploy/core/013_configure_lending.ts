import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
const {ethers} = require('hardhat');
import {getConfigForChain} from '../../config/index';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy, execute, read} = deployments;
	const {deployer, admin} = await getNamedAccounts();
	const {config} = getConfigForChain(await hre.getChainId());

	const middleFeeDistribution = await deployments.get(`MiddleFeeDistribution`);
	const lendingPoolAddressesProvider = await deployments.get(`LendingPoolAddressesProvider`);
	const aToken = await deployments.get(`AToken`);
	const stableDebtToken = await deployments.get(`StableDebtToken`);
	const variableDebtToken = await deployments.get(`VariableDebtToken`);
	const chefIncentivesController = await deployments.get(`ChefIncentivesController`);

	const LendingPoolConfiguratorImpl = await ethers.getContractFactory('LendingPoolConfigurator');
	const lendingPoolConfiguratorProxy = LendingPoolConfiguratorImpl.attach(
		await read('LendingPoolAddressesProvider', 'getLendingPoolConfigurator')
	);

	let newStratDeployed = false;

	const strategyAddresses = new Map();
	let enhancedTokensConfig = new Map<string, any>(config.TOKENS_CONFIG);
	for (const [key, value] of enhancedTokensConfig) {
		const strategyName = value.reservesParams.strategy.name;

		if (!strategyAddresses.has(strategyName)) {
			let strat = await deploy(strategyName, {
				from: deployer,
				log: true,
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
		await execute(
			'MiddleFeeDistribution',
			{from: deployer, log: true},
			'setAdmin',
			lendingPoolConfiguratorProxy.address
		);

		const inits = Array.from(enhancedTokensConfig.values()).map((value: any) => value.initInputParams);
		// console.log(inits);

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
		const aTokensAndRatesHelper = await deployments.get('ATokensAndRatesHelper');
		const aaveProtocolDataProvider = await deployments.get('AaveProtocolDataProvider');
		await execute(
			'LendingPoolAddressesProvider',
			{from: deployer, log: true, waitConfirmations: 3, autoMine: true},
			'setPoolAdmin',
			aTokensAndRatesHelper.address
		);

		await execute(
			'ATokensAndRatesHelper',
			{from: deployer, log: true, waitConfirmations: 3, autoMine: true},
			'configureReserves',
			inputParams
		);

		// Set deployer back as admin
		await execute('LendingPoolAddressesProvider', {from: deployer, log: true}, 'setPoolAdmin', deployer);

		let collatManager = await deploy('LendingPoolCollateralManager', {from: deployer, log: true});

		await execute(
			'LendingPoolAddressesProvider',
			{from: deployer, log: true},
			'setLendingPoolCollateralManager',
			collatManager.address
		);

		await execute(
			'LendingPoolAddressesProvider',
			{from: deployer, log: true},
			'setAddress',
			'0x0100000000000000000000000000000000000000000000000000000000000000',
			aaveProtocolDataProvider.address
		);
	}
};
export default func;
func.tags = ['core'];
