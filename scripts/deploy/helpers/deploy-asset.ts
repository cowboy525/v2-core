import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {getConfigForChain} from '../../../config';
import {getTxnOpts} from './getTxnOpts';

export const deployAsset = async (asset: any, hre: HardhatRuntimeEnvironment) => {
	const {deployments, getNamedAccounts, ethers} = hre;
	const {deploy, execute, read, get} = deployments;
	const {deployer, admin, treasury} = await getNamedAccounts();
	const {config} = getConfigForChain(await hre.getChainId());
	const txnOpts = await getTxnOpts(hre);

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
		...txnOpts,
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

	await execute('LendingPoolAddressesProvider', txnOpts, 'setPoolAdmin', aTokensAndRatesHelper.address);

	await execute('ATokensAndRatesHelper', txnOpts, 'configureReserves', reserveArray);
	await execute('LendingPoolAddressesProvider', txnOpts, 'setPoolAdmin', deployer);
	await execute(
		'AaveOracle',
		txnOpts,
		'setAssetSources',
		[initInputParams.underlyingAsset],
		[asset.chainlinkAggregator]
	);
};
