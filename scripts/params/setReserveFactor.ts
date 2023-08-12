import {getConfigForChain} from '../config';

const hre = require('hardhat');
const {deployments, getNamedAccounts, network} = hre;

const configureReserves = async (
	reserveFactor: number,
	lendingPoolAddressesProvider,
	aTokensAndRatesHelper,
	deployConfig
) => {
	await lendingPoolAddressesProvider.setPoolAdmin(aTokensAndRatesHelper.address);
	// configureReserves
	const TOKENS_CONFIG = new Map<string, any>(deployConfig.TOKENS_CONFIG);
	const inputParams = [];
	for (const [key, value] of TOKENS_CONFIG) {
		const tokenAddress = TOKENS_CONFIG.get(key)!.assetAddress;
		const {
			baseLTVAsCollateral,
			liquidationBonus,
			liquidationThreshold,
			_,
			stableBorrowRateEnabled,
			borrowingEnabled,
		} = value.reservesParams;

		if (baseLTVAsCollateral === '-1') continue;

		inputParams.push({
			asset: tokenAddress,
			baseLTV: baseLTVAsCollateral,
			liquidationThreshold: liquidationThreshold,
			liquidationBonus: liquidationBonus,
			reserveFactor: reserveFactor,
			stableBorrowingEnabled: stableBorrowRateEnabled,
			borrowingEnabled: borrowingEnabled,
		});
	}
	// patch
	// inputParams[0].asset = assetAddress;
	// console.log(inputParams);

	console.log(await lendingPoolAddressesProvider.owner());
	console.log(await lendingPoolAddressesProvider.getPoolAdmin());

	await aTokensAndRatesHelper.configureReserves(inputParams);
};

(async () => {
	const {get, execute} = deployments;
	const {deployer} = await getNamedAccounts();

	const {config} = getConfigForChain(await hre.getChainId());

	let addressProvider = await hre.ethers.getContract('LendingPoolAddressesProvider');
	let aTokensAndRatesHelper = await hre.ethers.getContract('ATokensAndRatesHelper');

	console.log(await addressProvider.owner());
	console.log(await addressProvider.getPoolAdmin());

	await configureReserves(1, addressProvider, aTokensAndRatesHelper, config);

	await addressProvider.setPoolAdmin(deployer);
	console.log(await addressProvider.owner());
	console.log(await addressProvider.getPoolAdmin());

	// await execute('PriceProvider', {from: deployer, log: true}, 'setUsePool', true);
})();
