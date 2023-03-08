import _ from "lodash";
import { DEPLOY_CONFIGS } from "../../../config";
import { DeployConfig } from "../types";

export const getConfigForChain = (chainId: number): DeployConfig => {
    let config = <DeployConfig>_.find(DEPLOY_CONFIGS, { CHAIN_ID: chainId });
    if (config === undefined) {
        throw new Error(`No config found for chain ID: ${chainId}`)
    }
    return config;
}