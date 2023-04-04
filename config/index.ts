import {DeployConfig} from '../scripts/deploy/types';
import HardhatDeployConfig from './31337';
import BscTestnetDeployConfig from './97';
import ArbiTestnetDeployConfig from './421613';
import GoerliDeployConfig from './5';
import ArbitrumConfig from './42161';
import BscDeployConfig from './56';

export const DEPLOY_CONFIGS: DeployConfig[] = [
	HardhatDeployConfig,
	BscTestnetDeployConfig,
	ArbiTestnetDeployConfig,
	GoerliDeployConfig,
	ArbitrumConfig,
];

export const getConfigForChain = (_chainId: string): {config: DeployConfig; baseAssetWrapped: string} => {
	const chainId = parseInt(_chainId);
	let config;
	let baseAssetWrapped = chainId == 97 || chainId == 56 ? 'WBNB' : 'WETH';

	let configs = {
		97: BscTestnetDeployConfig,
		// 421613: ArbiTestnetDeployConfig,
		42161: ArbitrumConfig,
		56: BscDeployConfig,
		31337: HardhatDeployConfig,
	};
	config = configs[chainId];

	return {
		config,
		baseAssetWrapped,
	};
};
