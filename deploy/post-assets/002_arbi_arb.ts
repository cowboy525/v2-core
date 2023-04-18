import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {deployAsset} from '../../scripts/deploy/helpers/deploy-asset';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy, get} = deployments;
	const {deployer} = await getNamedAccounts();
	const chainId = await hre.getChainId();

	if (network.tags.post_assets) {
		const assetName = 'ARB';
		let assetAddress;
		let oracleAddress;
		if (chainId == '42161' && !network.tags.mocks) {
			assetAddress = '0x912CE59144191C1204E64559FE8253a0e49E6548';
			oracleAddress = '0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6';
		} else if (chainId == '31337' || (chainId == '42161' && network.tags.mocks)) {
			assetAddress = (await get(assetName)).address;
			oracleAddress = (await get(`${assetName}Aggregator`)).address;
		} else {
			return;
		}

		let asset = {
			assetAddress,
			chainlinkAggregator: oracleAddress,
			borrowRate: '30000000000000000000000000',
			reservesParams: {
				aTokenImpl: 'AToken',
				baseLTVAsCollateral: '4000',
				borrowingEnabled: true,
				liquidationBonus: '11500',
				liquidationThreshold: '5000',
				reserveDecimals: '18',
				reserveFactor: '7500',
				stableBorrowRateEnabled: false,
				strategy: {
					baseVariableBorrowRate: '0',
					name: `rateStrategy${assetName}`,
					optimalUtilizationRate: '600000000000000000000000000',
					variableRateSlope1: '175000000000000000000000000',
					variableRateSlope2: '1000000000000000000000000000',
					stableRateSlope1: '100000000000000000000000000',
					stableRateSlope2: '3000000000000000000000000000',
				},
			},
			initInputParams: {
				aTokenName: `Radiant interest bearing ${assetName}`,
				aTokenSymbol: `r${assetName}`,
				params: '0x10',
				stableDebtTokenName: `Radiant stable debt bearing ${assetName}`,
				stableDebtTokenSymbol: `stableDebt${assetName}`,
				underlyingAsset: assetAddress,
				underlyingAssetDecimals: '18',
				underlyingAssetName: assetName,
				variableDebtTokenName: `Radiant variable debt bearing ${assetName}`,
				variableDebtTokenSymbol: `variableDebt${assetName}`,
				allocPoint: 1,
			},
		};
		await deployAsset(asset, hre);
		return true;
	}
};
export default func;
func.id = 'arbi_arb';
func.tags = ['arbi_arb'];
