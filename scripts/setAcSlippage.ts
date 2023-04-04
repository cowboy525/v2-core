const hre = require('hardhat');
const {deployments, getNamedAccounts} = hre;

(async () => {
	const {execute, read} = deployments;
	const {deployer} = await getNamedAccounts();
	// await execute('PriceProvider', {from: deployer, log: true}, 'setUsePool', true);
	// let r = await read('PoolHelper', {from: deployer, log: true}, 'getPrice');
	// console.log(r);

	let txn = await execute('Compounder', {from: deployer, log: true}, 'setSlippageLimit', '8000');
	console.log(txn);
})();
