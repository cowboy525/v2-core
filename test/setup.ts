import {getConfigForChain} from '../config';
import fs from 'fs';
import {advanceTimeAndBlock} from './shared/helpers';

const hre = require('hardhat');
const {deployments, getNamedAccounts} = hre;

export const setupTest = deployments.createFixture(async ({deployments, getNamedAccounts, ethers}, options) => {
	const [deployer, dao, treasury, admin, vestManager, starfleet, user1, user2, user3, user4] =
		await ethers.getSigners();

	const {config, baseAssetWrapped} = getConfigForChain(await hre.getChainId());
	await deployments.fixture(); // ensure you start from a fresh deployments

	const {read} = deployments;

	let stakingToken = await read('PoolHelper', 'lpTokenAddr');
	let lendingPool = await read('LendingPoolAddressesProvider', 'getLendingPool');
	let wrappedBaseDebtToken;

	let allTokenAddrs: any[] = [];
	let allTokens: any = {};
	let tickers: any = [];

	config.CHAINLINK_ETH_USD_AGGREGATOR_PROXY = (await ethers.getContract('WETHAggregator')).address;
	const allReservesTokens = await read('AaveProtocolDataProvider', 'getAllReservesTokens');

	for (let index = 0; index < allReservesTokens.length; index++) {
		const element = allReservesTokens[index];
		const [symbol, tokenAddress] = element;
		const [aTokenAddress, stableDebtTokenAddress, variableDebtTokenAddress] = await read(
			'AaveProtocolDataProvider',
			'getReserveTokensAddresses',
			tokenAddress
		);
		allTokens[`r${symbol}`] = aTokenAddress;
		allTokens[`vd${symbol}`] = variableDebtTokenAddress;
		allTokenAddrs.push(aTokenAddress);
		allTokenAddrs.push(variableDebtTokenAddress);

		if (symbol == baseAssetWrapped) {
			wrappedBaseDebtToken = variableDebtTokenAddress;
		}

		tickers.push({
			ticker: symbol,
			addr: tokenAddress,
			debt: variableDebtTokenAddress,
			deposit: aTokenAddress,
		});
	}

	let res = {
		priceProvider: await ethers.getContract('PriceProvider'),
		lockZap: await ethers.getContract('LockZap'),
		uniV2TwapOracle: await ethers.getContract('UniV2TwapOracle'),
		rdntToken: await ethers.getContract('RadiantOFT'),
		multiFeeDistribution: await ethers.getContract('MFD'),
		middleFeeDistribution: await ethers.getContract('MiddleFeeDistribution'),
		eligibilityProvider: await ethers.getContract('EligibilityDataProvider'),
		bountyManager: await ethers.getContract('BountyManager'),
		compounder: await ethers.getContract('Compounder'),
		chefIncentivesController: await ethers.getContract('ChefIncentivesController'),
		leverager: await ethers.getContract('Leverager'),
		wethGateway: await ethers.getContract('WETHGateway'),
		weth: await ethers.getContract('WETH'),
		lendingPool: await ethers.getContractAt('LendingPool', lendingPool),
	};

	// TODO: iterate above to generate deployData
	// let deployData: any;
	// for (const key of Object.keys(res)) {
	//     console.log(`${key}: ${(res as { [key: string]: string })[key]}`);
	//     deployData[key] = res[key]
	// }

	const deployData = {
		priceProvider: (await ethers.getContract('PriceProvider')).address,
		lockZap: (await ethers.getContract('LockZap')).address,
		uniV2TwapOracle: (await ethers.getContract('UniV2TwapOracle')).address,
		rdntToken: (await ethers.getContract('RadiantOFT')).address,
		multiFeeDistribution: (await ethers.getContract('MFD')).address,
		middleFeeDistribution: (await ethers.getContract('MiddleFeeDistribution')).address,
		eligibilityProvider: (await ethers.getContract('EligibilityDataProvider')).address,
		bountyManager: (await ethers.getContract('BountyManager')).address,
		chefIncentivesController: (await ethers.getContract('ChefIncentivesController')).address,
		leverager: (await ethers.getContract('Leverager')).address,
		compounder: await ethers.getContract('Compounder').address,
		wethGateway: (await ethers.getContract('WETHGateway')).address,
		weth: (await ethers.getContract('WETH')).address,
		lendingPool: (await ethers.getContractAt('LendingPool', lendingPool)).address,
		baseAssetWrappedAddress: (await ethers.getContract('WETH')).address,
		aTokensAndRatesHelper: (await ethers.getContract('ATokensAndRatesHelper')).address,
		aaveOracle: (await ethers.getContract('AaveOracle')).address,
		lendingPoolAddressesProvider: (await ethers.getContract('LendingPoolAddressesProvider')).address,
		// migration: (await ethers.getContract('Migration')).address,
		stakingToken,
		allTokenAddrs,
		allTokens,
	};

	await advanceTimeAndBlock(config.TWAP_PERIOD);
	await res.priceProvider.update();

	let result = {
		...res,
		deployConfig: config,
		deployData,
		usdc: await ethers.getContract('USDC'),
		user1,
		user2,
		user3,
		user4,
		deployer,
		dao,
		treasury,
		LOCK_DURATION: config.LOCK_INFO.LOCK_PERIOD[1],
	};

	// console.log(result);

	return result;
});
