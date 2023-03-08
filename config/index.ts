
import { DeployConfig } from "../scripts/deploy/types";
import HardhatDeployConfig from "./31337";
import BscTestnetDeployConfig from "./97";
import ArbiTestnetDeployConfig from "./421613";
import GoerliDeployConfig from "./5";

export const DEPLOY_CONFIGS: DeployConfig[] = [
    HardhatDeployConfig,
    BscTestnetDeployConfig,
    ArbiTestnetDeployConfig,
    GoerliDeployConfig
]

export const getConfigForChain = (chainId): { config: DeployConfig, baseAssetWrapped: string } => {
    let config;
    let baseAssetWrapped = chainId == 97 ? 'WBNB' : 'WETH';
    if (chainId == 97) {
        config = BscTestnetDeployConfig
    } else if (chainId == 421613) {
        config = ArbiTestnetDeployConfig
    } else {
        config = HardhatDeployConfig;
    }
    return {
        config,
        baseAssetWrapped
    }
}