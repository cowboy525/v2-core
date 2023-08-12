import {ChefIncentivesController} from '../typechain';
import fs from 'fs';
import paramData from './data';

const hre = require('hardhat');
const {deployments, getNamedAccounts, network} = hre;

(async () => {
	const {get, execute, read} = deployments;
	const {deployer} = await getNamedAccounts();

	let localExecution = network.name === 'localhost';

	const data = JSON.parse(fs.readFileSync(`./deployments/${network.name}/.deployData.json`).toString());

	let addressProvider = await hre.ethers.getContract('LendingPoolAddressesProvider');

	const TOKENS_CONFIG = new Map(paramData[network.name].rates);
	const strategyAddresses = new Map();
	for (const [key, value] of TOKENS_CONFIG) {
		const strategyName = value.name;
		if (!strategyAddresses.has(strategyName)) {
			const DefaultReserveInterestRateStrategy = await hre.ethers.getContractFactory(
				'DefaultReserveInterestRateStrategy'
			);
			console.log(`Deploying new strat...`);

			const defaultReserveInterestRateStrategy = await DefaultReserveInterestRateStrategy.deploy(
				addressProvider.address,
				hre.ethers.utils.parseUnits(value.optimalUtilizationRate.toString(), 27),
				0,
				hre.ethers.utils.parseUnits(value.variableRateSlope1.toString(), 27),
				hre.ethers.utils.parseUnits(value.variableRateSlope2.toString(), 27),
				0,
				0
			);
			await defaultReserveInterestRateStrategy.deployed();
			console.log(`${strategyName}:`, defaultReserveInterestRateStrategy.address);
			console.log(` `);
			strategyAddresses.set(strategyName, defaultReserveInterestRateStrategy.address);
		}
	}

	console.log(strategyAddresses);
	console.log(' ');

	let owner = await addressProvider.getPoolAdmin();
	console.log(`Current admin: ${owner}`);
	let addrs = paramData[network.name].underlying;

	if (localExecution) {
		const signer2 = await hre.ethers.getSigner('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
		const tx = await signer2.sendTransaction({
			to: owner,
			value: hre.ethers.utils.parseEther('1.0'),
		});
		await hre.network.provider.request({
			method: 'hardhat_impersonateAccount',
			params: [owner],
		});
		const ownerSigner = await hre.ethers.getSigner(owner);

		let configuratorAddr = await addressProvider.getLendingPoolConfigurator();

		console.log(`configuratorAddr:`);
		console.log(configuratorAddr);
		const configurator = await hre.ethers.getContractAt('LendingPoolConfigurator', configuratorAddr);

		for (const [key, value] of Object.entries(addrs)) {
			let assetDetails = TOKENS_CONFIG.get(key);
			let stratName = assetDetails?.name;
			let stratAddr = strategyAddresses.get(stratName);
			let underlyingAddr = addrs[key];
			console.log(' ');
			console.log(key);
			console.log(stratName);
			console.log(underlyingAddr);
			console.log(stratAddr);

			let txn = await configurator
				.connect(ownerSigner)
				.setReserveInterestRateStrategyAddress(underlyingAddr, stratAddr);
			console.log(`txn: ${txn.hash}`);
		}
	} else {
		console.log(` `);
		console.log(`===== DEFENDER PARAMS =====`);
		for (const [key, value] of Object.entries(addrs)) {
			let assetDetails = TOKENS_CONFIG.get(key);
			let stratName = assetDetails?.name;
			let stratAddr = strategyAddresses.get(stratName);
			let underlyingAddr = addrs[key];
			console.log(
				`LendingPoolConfigurator.setReserveInterestRateStrategyAddress: ${underlyingAddr}, ${stratAddr}`
			);
		}
		console.log(` `);
	}
})();
