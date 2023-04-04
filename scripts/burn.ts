const hre = require('hardhat');
const {deployments, getNamedAccounts} = hre;

(async () => {
	const {execute, read} = deployments;
	const {deployer} = await getNamedAccounts();
	// await execute('PriceProvider', {from: deployer, log: true}, 'setUsePool', true);
	// let r = await read('PoolHelper', {from: deployer, log: true}, 'getPrice');
	// console.log(r);

	let txn = await execute('RadiantOFT', {from: deployer, log: true}, 'burn', '22000000000000000000000000');
	console.log(txn);
})();
