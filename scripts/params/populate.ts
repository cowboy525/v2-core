import {LendingPool, WETH} from '../../typechain';
import {ChefIncentivesController} from '../typechain';
import paramData from './data';
import fs from 'fs';

const hre = require('hardhat');
const {deployments, getNamedAccounts, network} = hre;

(async () => {
	const {get, execute, read} = deployments;
	const {deployer} = await getNamedAccounts();

	let localExecution = network.name === 'localhost';

	const rps = hre.ethers.utils.parseEther(paramData[network.name].rps.toString());
	const data = JSON.parse(fs.readFileSync(`./deployments/${network.name}/.deployData.json`).toString());

	const networkParams = paramData[network.name];

	const weth = <WETH>await hre.ethers.getContractAt('WETH', data.baseAssetWrappedAddress);
	const lendingPool = <LendingPool>await hre.ethers.getContractAt('LendingPool', data.lendingPool);

	await (await weth.deposit({value: hre.ethers.utils.parseEther('1')})).wait();
	await (await weth.approve(data.lendingPool, hre.ethers.constants.MaxUint256)).wait();
	await (
		await lendingPool.deposit(data.baseAssetWrappedAddress, hre.ethers.utils.parseEther('1'), deployer, 0)
	).wait();

	console.log(`WETH deposit done.`);

	let borrowData = {
		USDC: {
			amount: 1,
			decimals: 6,
		},
		USDT: {
			amount: 1,
			decimals: 6,
		},
		DAI: {
			amount: 1,
			decimals: 18,
		},
		ARB: {
			amount: 1,
			decimals: 18,
		},
		WETH: {
			amount: 0.0007,
			decimals: 18,
		},
		WSTETH: {
			amount: 0.0007,
			decimals: 18,
		},
		WBTC: {
			amount: 0.00003,
			decimals: 8,
		},
	};

	for (const [assetName, assetAddress] of Object.entries(networkParams.underlying)) {
		const {amount, decimals} = borrowData[assetName];
		const amt = hre.ethers.utils.parseUnits(amount.toString(), decimals);
		await (await lendingPool.borrow(assetAddress, amt, 2, 0, deployer)).wait();
		console.log(`${assetName} borrow done.`);
	}
})();
