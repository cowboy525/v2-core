const hre = require('hardhat');
const {deployments, getNamedAccounts} = hre;

(async () => {
	const {execute, read} = deployments;
	const {deployer} = await getNamedAccounts();
	let txn = await execute('PriceProvider', {from: deployer, log: true}, 'update');
	console.log(txn);
})();
