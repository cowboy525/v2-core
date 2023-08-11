import {DeployConfig} from '../scripts/deploy/types';
import HardhatDeployConfig from './31337';
import ArbitrumConfig from './42161';
import BscDeployConfig from './56';
import MainnetConfig from './1';
import GoerliDeployConfig from './5';

export const DEPLOY_CONFIGS: DeployConfig[] = [HardhatDeployConfig, ArbitrumConfig];

export const getConfigForChain = (_chainId: string): {config: DeployConfig; baseAssetWrapped: string} => {
	const chainId = parseInt(_chainId);
	let config;
	let baseAssetWrapped = chainId == 97 || chainId == 56 ? 'WBNB' : 'WETH';

	let configs = {
		1: MainnetConfig,
		5: GoerliDeployConfig,
		56: BscDeployConfig,
		31337: HardhatDeployConfig,
		42161: ArbitrumConfig,
	};
	config = configs[chainId];

	return {
		config,
		baseAssetWrapped,
	};
};
