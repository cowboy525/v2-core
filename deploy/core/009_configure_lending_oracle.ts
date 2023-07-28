import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'configure_lending_oracle',
	tags: ['core'],
	dependencies: ['deploy_lending_oracle'],
	runOnce: true,
});
let func = step.setFunction(async function () {
	const {config, network, get, execute, deployer} = step;

	const aaveOracle = await get('AaveOracle');
	const lendingRateOracle = await get('LendingRateOracle');

	// TODO: dedupe this from prev step
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

	const borrowRates = Array.from(config.TOKENS_CONFIG.values()).map((value: any) => value[1].borrowRate);

	await execute('LendingPoolAddressesProvider', 'setPriceOracle', aaveOracle.address);
	await execute('LendingPoolAddressesProvider', 'setLendingRateOracle', lendingRateOracle.address);
	await execute(
		'LendingRateOracle',
		'transferOwnership',
		(
			await deployments.get('StableAndVariableTokensHelper')
		).address
	);
	await execute(
		'StableAndVariableTokensHelper',
		'setOracleBorrowRates',
		assetAddresses,
		borrowRates,
		lendingRateOracle.address
	);
	await execute('StableAndVariableTokensHelper', 'setOracleOwnership', lendingRateOracle.address, deployer);
});
export default func;
