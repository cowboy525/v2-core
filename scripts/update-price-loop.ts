const hre = require('hardhat');
const {deployments, getNamedAccounts} = hre;

(async () => {
	const {execute, read} = deployments;
	const {deployer} = await getNamedAccounts();
	// await execute('PriceProvider', {from: deployer, log: true}, 'setUsePool', true);
	// let r = await read('PoolHelper', {from: deployer, log: true}, 'getPrice');
	// console.log(r);

	while (true) {
		try {
			let txn = await execute('PriceProvider', {from: deployer, log: true}, 'update');
			console.log(txn.transactionHash);
			console.log(new Date());
		} catch (e) {
			console.log(`skiped a round`);
		}

		await new Promise((res, rej) => {
			setTimeout(res, 30 * 1000);
		});
		console.log(` `);
	}
})();
