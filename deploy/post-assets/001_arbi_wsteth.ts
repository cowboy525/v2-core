import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {deployAsset} from '../../scripts/deploy/helpers/deploy-asset';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy, get} = deployments;
	const {deployer} = await getNamedAccounts();
	const chainId = await hre.getChainId();

	if (network.tags.post_assets) {
		const assetName = 'WSTETH';
		let assetAddress;
		let oracleAddress;
		if (chainId == '42161' && !network.tags.mocks) {
			assetAddress = '0x5979D7b546E38E414F7E9822514be443A4800529';
			const wstethOracle = await deploy('WSTETHOracle', {
				from: deployer,
				log: true,
				proxy: {
					proxyContract: 'OpenZeppelinTransparentProxy',
					execute: {
						init: {
							methodName: 'initialize',
							args: [
								'0x07c5b924399cc23c24a95c8743de4006a32b7f2a',
								'0xB1552C5e96B312d0Bf8b554186F846C40614a540',
							],
						},
					},
				},
			});
			oracleAddress = wstethOracle.address;
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
				baseLTVAsCollateral: '7000',
				borrowingEnabled: true,
				liquidationBonus: '11500',
				liquidationThreshold: '8000',
				reserveDecimals: '18',
				reserveFactor: '7500',
				stableBorrowRateEnabled: false,
				strategy: {
					baseVariableBorrowRate: '0',
					name: `rateStrategy${assetName}`,
					optimalUtilizationRate: '700000000000000000000000000',
					variableRateSlope1: '130000000000000000000000000',
					variableRateSlope2: '950000000000000000000000000',
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
				allocPoint: 2,
			},
		};
		await deployAsset(asset, hre);
		return true;
	}
};
export default func;
func.id = 'arbi_wsteth';
func.tags = ['arbi_wsteth'];
