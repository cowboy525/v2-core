const hre = require('hardhat');
const {deployments, getNamedAccounts, network} = hre;

(async () => {
	const {get, execute} = deployments;
	const {deployer} = await getNamedAccounts();

	await execute('PriceProvider', {from: deployer, log: true}, 'setUsePool', true);
})();
