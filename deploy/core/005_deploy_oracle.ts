import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getConfigForChain} from '../../config/index';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts, network} = hre;
	const {deploy, execute, read} = deployments;
	const {deployer} = await getNamedAccounts();
	const {config} = getConfigForChain(await hre.getChainId());

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

	const borrowRates = Array.from(config.TOKENS_CONFIG.values()).map((value: any) => value[1].borrowRate);

	let aaveOracle = await deploy('AaveOracle', {
		from: deployer,
		log: true,
		args: [
			assetAddresses,
			chainlinkAggregators,
			'0x0000000000000000000000000000000000000000',
			'0x0000000000000000000000000000000000000000', // USD
			'100000000', // 10**8
		],
	});

	if (aaveOracle.newlyDeployed) {
		await execute('LendingPoolAddressesProvider', {from: deployer}, 'setPriceOracle', aaveOracle.address);
	}

	let lendingRateOracle = await deploy('LendingRateOracle', {
		from: deployer,
		log: true,
		args: [],
	});

	if (lendingRateOracle.newlyDeployed) {
		await execute(
			'LendingPoolAddressesProvider',
			{from: deployer, log: true},
			'setLendingRateOracle',
			lendingRateOracle.address
		);

		await execute(
			'LendingRateOracle',
			{from: deployer, log: true},
			'transferOwnership',
			(
				await deployments.get('StableAndVariableTokensHelper')
			).address
		);

		await execute(
			'StableAndVariableTokensHelper',
			{from: deployer, log: true},
			'setOracleBorrowRates',
			assetAddresses,
			borrowRates,
			lendingRateOracle.address
		);

		await execute(
			'StableAndVariableTokensHelper',
			{from: deployer, log: true},
			'setOracleOwnership',
			lendingRateOracle.address,
			deployer
		);
	}

	await deploy('AaveProtocolDataProvider', {
		from: deployer,
		log: true,
		args: [lendingPoolAddressesProvider.address],
	});
};
export default func;
func.tags = ['core'];
