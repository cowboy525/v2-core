import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {deployAsset} from '../../scripts/deploy/helpers/deploy-asset';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy} = deployments;
	const {deployer} = await getNamedAccounts();
	const chainId = await hre.getChainId();

	if (chainId == '31337' || chainId == '42161') {
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

		let asset = {
			assetAddress: '0x5979D7b546E38E414F7E9822514be443A4800529',
			chainlinkAggregator: wstethOracle.address,
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
					name: 'rateStrategyWSTETH',
					optimalUtilizationRate: '700000000000000000000000000',
					variableRateSlope1: '130000000000000000000000000',
					variableRateSlope2: '950000000000000000000000000',
					stableRateSlope1: '100000000000000000000000000',
					stableRateSlope2: '3000000000000000000000000000',
				},
			},
			initInputParams: {
				aTokenName: 'Radiant interest bearing WSTETH',
				aTokenSymbol: 'rWSTETH',
				params: '0x10',
				stableDebtTokenName: 'Radiant stable debt bearing WSTETH',
				stableDebtTokenSymbol: 'stableDebtWSTETH',
				underlyingAsset: '0x5979D7b546E38E414F7E9822514be443A4800529',
				underlyingAssetDecimals: '18',
				underlyingAssetName: 'WSTETH',
				variableDebtTokenName: 'Radiant variable debt bearing WSTETH',
				variableDebtTokenSymbol: 'variableDebtWSTETH',
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
