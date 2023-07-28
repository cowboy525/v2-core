import {DeployConfig} from '../../../scripts/deploy/types';

export async function getAssetData(
	config?: DeployConfig
): Promise<{assetAddresses: any[]; chainlinkAggregators: any[]}> {
	let assetAddresses = [];
	let chainlinkAggregators = [];

	for (let i = 0; i < config.TOKENS_CONFIG.length; i++) {
		const element = config.TOKENS_CONFIG[i];
		let ticker = element[0];
		let data = element[1];

		let token, agg;
		if (network.tags.mocks) {
			token = (await deployments.get(ticker)).address;
			agg = (await deployments.get(`${ticker}Aggregator`)).address;
		} else {
			token = data.assetAddress;
			agg = data.chainlinkAggregator;
		}
		assetAddresses.push(token);
		chainlinkAggregators.push(agg);
	}
	return {
		assetAddresses,
		chainlinkAggregators,
	};
}
