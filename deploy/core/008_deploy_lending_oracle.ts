import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'deploy_lending_oracle',
	tags: ['core'],
	dependencies: ['lending', 'assets'],
});
let func = step.setFunction(async function () {
	const {deploy, config, network} = step;

	const lendingPoolAddressesProvider = await deployments.get('LendingPoolAddressesProvider');

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

	await deploy('AaveOracle', {
		args: [
			assetAddresses,
			chainlinkAggregators,
			'0x0000000000000000000000000000000000000000',
			'0x0000000000000000000000000000000000000000', // USD
			'100000000', // 10**8
		],
	});

	await deploy('LendingRateOracle', {
		args: [],
	});

	await deploy('AaveProtocolDataProvider', {
		args: [lendingPoolAddressesProvider.address],
	});
});
export default func;
