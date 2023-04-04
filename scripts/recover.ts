const hre = require('hardhat');
const {deployments, getNamedAccounts} = hre;

(async () => {
	const {execute, read} = deployments;
	const {deployer} = await getNamedAccounts();
	// await execute('PriceProvider', {from: deployer, log: true}, 'setUsePool', true);
	// let r = await read('PoolHelper', {from: deployer, log: true}, 'getPrice');
	// console.log(r);

	let txn = await execute(
		'MFD',
		{from: deployer, log: true},
		'recoverERC20',
		'0x618aB111b5a086127d44efD9CaFD3b5428AA4577',
		hre.ethers.utils.parseUnits('20', 18)
	);
	console.log(txn);
})();
