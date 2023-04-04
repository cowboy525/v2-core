import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
const {ethers} = require('hardhat');
import {getConfigForChain} from '../../config/index';
import {exec} from 'child_process';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy, execute, read} = deployments;
	const {deployer, admin, treasury} = await getNamedAccounts();
	const {config} = getConfigForChain(await hre.getChainId());

	const middleFeeDistribution = await deployments.get(`MiddleFeeDistribution`);
	const lendingPoolAddressesProvider = await deployments.get(`LendingPoolAddressesProvider`);
	const aToken = await deployments.get(`AToken`);
	const stableDebtToken = await deployments.get(`StableDebtToken`);
	const variableDebtToken = await deployments.get(`VariableDebtToken`);
	const chefIncentivesController = await deployments.get(`ChefIncentivesController`);
	const interestRateStrategyAddress = await deployments.get(`rateStrategyWETH`);

	const LendingPoolConfiguratorImpl = await ethers.getContractFactory('LendingPoolConfigurator');
	const lendingPoolConfiguratorProxy = LendingPoolConfiguratorImpl.attach(
		await read('LendingPoolAddressesProvider', 'getLendingPoolConfigurator')
	);

	const wstethOracle = await deploy('WSTETHOracle', {
		from: deployer,
		log: true,
		proxy: {
			proxyContract: 'OpenZeppelinTransparentProxy',
			execute: {
				init: {
					methodName: 'initialize',
					args: ['0x07c5b924399cc23c24a95c8743de4006a32b7f2a', '0xB1552C5e96B312d0Bf8b554186F846C40614a540'],
				},
			},
		},
	});
	/*{
		aTokenImpl: '0xb007167714e2940013EC3bb551584130B7497E22',
		aTokenName: 'Radiant interest bearing USDT',
		aTokenSymbol: 'rUSDT',
		incentivesController: '0x124dDf9BdD2DdaD012ef1D5bBd77c00F05C610DA',
		interestRateStrategyAddress: '0xbe18A1B61ceaF59aEB6A9bC81AB4FB87D56Ba167',
		params: '0x10',
		stableDebtTokenImpl: '0x6b39b761b1b64C8C095BF0e3Bb0c6a74705b4788',
		stableDebtTokenName: 'Radiant stable debt bearing USDT',
		stableDebtTokenSymbol: 'stableDebtUSDT',
		treasury: '0x3a622DB2db50f463dF562Dc5F341545A64C580fc',
		underlyingAsset: '0x666D0c3da3dBc946D5128D06115bb4eed4595580',
		underlyingAssetDecimals: '6',
		underlyingAssetName: 'USDT',
		variableDebtTokenImpl: '0xeC827421505972a2AE9C320302d3573B42363C26',
		variableDebtTokenName: 'Radiant variable debt bearing USDT',
		variableDebtTokenSymbol: 'variableDebtUSDT',
		allocPoint: 100
	  },
	  {
		aTokenImpl: '0xb007167714e2940013EC3bb551584130B7497E22',
		aTokenName: 'Radiant interest bearing DAI',
		aTokenSymbol: 'rDAI',
		incentivesController: '0x124dDf9BdD2DdaD012ef1D5bBd77c00F05C610DA',
		**interestRateStrategyAddress: '0x25C0a2F0A077F537Bd11897F04946794c2f6f1Ef',
		params: '0x10',
		stableDebtTokenImpl: '0x6b39b761b1b64C8C095BF0e3Bb0c6a74705b4788',
		stableDebtTokenName: 'Radiant stable debt bearing DAI',
		stableDebtTokenSymbol: 'stableDebtDAI',
		treasury: '0x3a622DB2db50f463dF562Dc5F341545A64C580fc',
		**underlyingAsset: '0xb868Cc77A95a65F42611724AF05Aa2d3B6Ec05F2',
		underlyingAssetDecimals: '18',
		underlyingAssetName: 'DAI',
		variableDebtTokenImpl: '0xeC827421505972a2AE9C320302d3573B42363C26',
		variableDebtTokenName: 'Radiant variable debt bearing DAI',
		variableDebtTokenSymbol: 'variableDebtDAI',
		allocPoint: 100
	  },

	  only 2 things different between 2 tokens is interestRateStrategyAddress and the underlying asset (duh)
	  _initReserve in LPC will create a new proxy for an Atoken
	  we just need to call LPC with the initReserveInput setup
	  however we do need an interestRateStrategy already*/

	//console.log(config.POSTDEPLOY_TOKEN_CONFIG[0][1]);
	let i;
	for(i = 0; i < config.POSTDEPLOY_TOKEN_CONFIG.length; i++){
		console.log(config.POSTDEPLOY_TOKEN_CONFIG.length);
		let initInputParams = config.POSTDEPLOY_TOKEN_CONFIG[i][1].initInputParams;
		let reserveInputParams = config.POSTDEPLOY_TOKEN_CONFIG[i][1].reservesParams;

		/*still need to set aTokenIMPL, incentivesController, interestRateStrategy, stableDebtTokenImpl,
			treasury, variableDebtTokenIMPL*/
		initInputParams.aTokenImpl = aToken.address;
		initInputParams.aTokenImpl = aToken.address;
		// initInputParams.chainlinkAggregator = wstethOracle.address;
		initInputParams.incentivesController = chefIncentivesController.address;
		initInputParams.interestRateStrategyAddress = interestRateStrategyAddress.address;
		initInputParams.stableDebtTokenImpl = stableDebtToken.address;
		initInputParams.variableDebtTokenImpl = variableDebtToken.address;
		initInputParams.treasury = middleFeeDistribution.address;

		const lendingPool = await read('LendingPoolAddressesProvider', 'getLendingPool');
		const aTokensAndRatesHelper = await deployments.get('ATokensAndRatesHelper');

		console.log(`batchInitReserve`);
		console.log(initInputParams);
		console.log({
			aTokenImpl: '0x96E303b6D807c0824E83f954784e2d6f3614f167',
			aTokenName: 'Radiant interest bearing WETH',
			aTokenSymbol: 'rWETH',
			incentivesController: '0x1c1521cf734CD13B02e8150951c3bF2B438be780',
			interestRateStrategyAddress: '0xd6096fbEd8bCc461d06b0C468C8b1cF7d45dC92d',
			params: '0x10',
			stableDebtTokenImpl: '0x9CC8B5379C40E24F374cd55973c138fff83ed214',
			stableDebtTokenName: 'Radiant stable debt bearing WETH',
			stableDebtTokenSymbol: 'stableDebtWETH',
			treasury: '0x9f62EE65a8395824Ee0821eF2Dc4C947a23F0f25',
			underlyingAsset: '0x9d136eEa063eDE5418A6BC7bEafF009bBb6CFa70',
			underlyingAssetDecimals: '18',
			underlyingAssetName: 'WETH',
			variableDebtTokenImpl: '0xd3b893cd083f07Fe371c1a87393576e7B01C52C6',
			variableDebtTokenName: 'Radiant variable debt bearing WETH',
			variableDebtTokenSymbol: 'variableDebtWETH',
			allocPoint: 100,
		});

		await (await lendingPoolConfiguratorProxy.batchInitReserve([initInputParams])).wait();
		const reserveArray = [
			{
				asset: config.POSTDEPLOY_TOKEN_CONFIG[i][1].assetAddress,
				baseLTV: config.POSTDEPLOY_TOKEN_CONFIG[i][1].reservesParams.baseLTVAsCollateral,
				liquidationThreshold: config.POSTDEPLOY_TOKEN_CONFIG[i][1].reservesParams.liquidationThreshold,
				liquidationBonus: config.POSTDEPLOY_TOKEN_CONFIG[i][1].reservesParams.liquidationBonus,
				reserveFactor: config.POSTDEPLOY_TOKEN_CONFIG[i][1].reservesParams.reserveFactor,
				stableBorrowingEnabled: config.POSTDEPLOY_TOKEN_CONFIG[i][1].reservesParams.stableBorrowRateEnabled,
				borrowingEnabled: config.POSTDEPLOY_TOKEN_CONFIG[i][1].reservesParams.borrowingEnabled,
			},
		];

		await execute(
			'LendingPoolAddressesProvider',
			{from: deployer, log: true},
			'setPoolAdmin',
			aTokensAndRatesHelper.address
		);

		console.log(`configureReserves`);
		console.log(reserveArray);

		await execute('ATokensAndRatesHelper', {from: deployer, log: true}, 'configureReserves', reserveArray);
		await execute('LendingPoolAddressesProvider', {from: deployer, log: true}, 'setPoolAdmin', deployer);
		let oracle;
		
		oracle = config.POSTDEPLOY_TOKEN_CONFIG[i][1].chainlinkAggregator;
		if(oracle === ``){
			oracle = wstethOracle.address;
		}
		await execute(
			'AaveOracle',
			{from: deployer, log: true},
			'setAssetSources',
			[initInputParams.underlyingAsset],
			[oracle]
		);
	}
};
export default func;
func.tags = ['core', 'deployNewReserve', 'ArbitrumDeploy'];
