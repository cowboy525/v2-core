import {ethers} from 'hardhat';
import {BountyManager, MultiFeeDistribution, MiddleFeeDistribution} from '../typechain';

const _ = require('lodash');
const hre = require('hardhat');
const {deployments, getNamedAccounts} = hre;

(async () => {
	const {execute, deploy, read, get} = deployments;
	const {deployer} = await getNamedAccounts();

	const AaveProtocolDataProviderAddress = await hre.ethers.getContract('AaveProtocolDataProvider');

	const allReservesTokens = await AaveProtocolDataProviderAddress.getAllReservesTokens();

	const allReservesData = await Promise.all(
		allReservesTokens.map((entry: any) => AaveProtocolDataProviderAddress.getReserveData(entry.tokenAddress))
	);

	const data = allReservesData.map((entry: any, index: any) => {
		return {
			symbol: allReservesTokens[index].symbol,
			tokenAddress: allReservesTokens[index].tokenAddress,
			availableLiquidity: entry.availableLiquidity.toString(),
			totalStableDebt: entry.totalStableDebt.toString(),
			totalVariableDebt: entry.totalVariableDebt.toString(),
			liquidityRate: entry.liquidityRate.toString(),
			variableBorrowRate: entry.variableBorrowRate.toString(),
			stableBorrowRate: entry.stableBorrowRate.toString(),
			averageStableBorrowRate: entry.averageStableBorrowRate.toString(),
			liquidityIndex: entry.liquidityIndex.toString(),
			variableBorrowIndex: entry.variableBorrowIndex.toString(),
			lastUpdateTimestamp: entry.lastUpdateTimestamp,
		};
	});

	console.log(data);
})();
