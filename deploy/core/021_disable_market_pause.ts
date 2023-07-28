import {ethers} from 'hardhat';
import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'disable_market_pause',
	tags: ['core'],
	dependencies: ['lending', 'distributors'],
	runOnce: true,
});
let func = step.setFunction(async function () {
	const {get} = step;

	// TODO: better way to handle this proxy
	let lendingPoolAddressesProvider = await ethers.getContract('LendingPoolAddressesProvider');
	let LendingPoolConfiguratorImpl = await ethers.getContractFactory('LendingPoolConfigurator');
	const lendingPoolConfiguratorProxy = LendingPoolConfiguratorImpl.attach(
		await lendingPoolAddressesProvider.getLendingPoolConfigurator()
	);
	await (await lendingPoolConfiguratorProxy.setPoolPause(false)).wait();
});
export default func;
