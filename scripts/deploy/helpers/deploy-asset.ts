import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {getConfigForChain} from '../../../config';

export const deployAsset = async (asset: any, hre: HardhatRuntimeEnvironment) => {
	const {deployments, getNamedAccounts, ethers} = hre;
	const {deploy, execute, read, get} = deployments;
	const {deployer, admin, treasury} = await getNamedAccounts();
	const {config} = getConfigForChain(await hre.getChainId());

	const lendingPoolAddressesProvider = await deployments.get(`LendingPoolAddressesProvider`);
	const aTokensAndRatesHelper = await deployments.get('ATokensAndRatesHelper');

	const middleFeeDistribution = await deployments.get(`MiddleFeeDistribution`);
	const aToken = await deployments.get(`AToken`);
	const stableDebtToken = await deployments.get(`StableDebtToken`);
	const variableDebtToken = await deployments.get(`VariableDebtToken`);
	const chefIncentivesController = await deployments.get(`ChefIncentivesController`);

	const LendingPoolConfiguratorImpl = await ethers.getContractFactory('LendingPoolConfigurator');
	const lendingPoolConfiguratorProxy = LendingPoolConfiguratorImpl.attach(
		await read('LendingPoolAddressesProvider', 'getLendingPoolConfigurator')
	);

	let strategy = asset.reservesParams.strategy;
	let strategyContract = await deploy(strategy.name, {
		from: deployer,
		log: true,
		contract: 'DefaultReserveInterestRateStrategy',
		args: [
			lendingPoolAddressesProvider.address,
			strategy.optimalUtilizationRate,
			strategy.baseVariableBorrowRate,
			strategy.variableRateSlope1,
			strategy.variableRateSlope2,
			strategy.stableRateSlope1,
			strategy.variableRateSlope2,
		],
	});

	let initInputParams = asset.initInputParams;
	initInputParams.aTokenImpl = aToken.address;
	initInputParams.incentivesController = chefIncentivesController.address;
	initInputParams.interestRateStrategyAddress = strategyContract.address;
	initInputParams.stableDebtTokenImpl = stableDebtToken.address;
	initInputParams.variableDebtTokenImpl = variableDebtToken.address;
	initInputParams.treasury = middleFeeDistribution.address;

	await (await lendingPoolConfiguratorProxy.batchInitReserve([initInputParams])).wait();
	const reserveArray = [
		{
			asset: asset.assetAddress,
			baseLTV: asset.reservesParams.baseLTVAsCollateral,
			liquidationThreshold: asset.reservesParams.liquidationThreshold,
			liquidationBonus: asset.reservesParams.liquidationBonus,
			reserveFactor: asset.reservesParams.reserveFactor,
			stableBorrowingEnabled: asset.reservesParams.stableBorrowRateEnabled,
			borrowingEnabled: asset.reservesParams.borrowingEnabled,
		},
	];

	await execute(
		'LendingPoolAddressesProvider',
		{from: deployer, log: true},
		'setPoolAdmin',
		aTokensAndRatesHelper.address
	);

	await execute('ATokensAndRatesHelper', {from: deployer, log: true}, 'configureReserves', reserveArray);
	await execute('LendingPoolAddressesProvider', {from: deployer, log: true}, 'setPoolAdmin', deployer);
	await execute(
		'AaveOracle',
		{from: deployer, log: true},
		'setAssetSources',
		[initInputParams.underlyingAsset],
		[asset.chainlinkAggregator]
	);
};
