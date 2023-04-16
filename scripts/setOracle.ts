const hre = require('hardhat');
const {deployments, getNamedAccounts, network} = hre;

(async () => {
	const {get, execute} = deployments;
	const {deployer} = await getNamedAccounts();
	await execute(
		'PriceProvider',
		{from: deployer, log: true},
		'setOracle',
		'0x2ed49363057Aa5be5EA133D8FE8C9c9cd488d3d2'
	);
	await execute('PriceProvider', {from: deployer, log: true}, 'setUsePool', false);
})();
