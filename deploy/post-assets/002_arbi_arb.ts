import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {deployAsset} from '../../scripts/deploy/helpers/deploy-asset';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy} = deployments;
	const {deployer} = await getNamedAccounts();
	const chainId = await hre.getChainId();

	if (chainId == '31337' || chainId == '42161') {
		let asset = {
			assetAddress: '0x912CE59144191C1204E64559FE8253a0e49E6548',
			chainlinkAggregator: '0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6',
			borrowRate: '30000000000000000000000000',
			reservesParams: {
				aTokenImpl: 'AToken',
				baseLTVAsCollateral: '8000',
				borrowingEnabled: true,
				liquidationBonus: '11500',
				liquidationThreshold: '8250',
				reserveDecimals: '18',
				reserveFactor: '7500',
				stableBorrowRateEnabled: false,
				strategy: {
					baseVariableBorrowRate: '0',
					name: 'rateStrategyARB',
					optimalUtilizationRate: '700000000000000000000000000',
					variableRateSlope1: '175000000000000000000000000',
					variableRateSlope2: '950000000000000000000000000',
					stableRateSlope1: '100000000000000000000000000',
					stableRateSlope2: '3000000000000000000000000000',
				},
			},
			initInputParams: {
				aTokenName: 'Radiant interest bearing ARB',
				aTokenSymbol: 'rARB',
				params: '0x10',
				stableDebtTokenName: 'Radiant stable debt bearing ARB',
				stableDebtTokenSymbol: 'stableDebtARB',
				underlyingAsset: '0x912CE59144191C1204E64559FE8253a0e49E6548',
				underlyingAssetDecimals: '18',
				underlyingAssetName: 'ARB',
				variableDebtTokenName: 'Radiant variable debt bearing ARB',
				variableDebtTokenSymbol: 'variableDebtARB',
				allocPoint: 100,
			},
		};
		await deployAsset(asset, hre);
		return true;
	}
};
export default func;
func.id = 'arbi_arb';
func.tags = ['arbi_arb'];
