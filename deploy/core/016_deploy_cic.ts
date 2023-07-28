import {ethers} from 'hardhat';
import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'deploy_cic',
	tags: ['core', 'cic'],
	dependencies: ['lending', 'distributors'],
});
let func = step.setFunction(async function () {
	const {deploy, get, read, config} = step;

	const edp = await get('EligibilityDataProvider');
	const middleFeeDistribution = await get(`MiddleFeeDistribution`);
	const LendingPoolConfiguratorImpl = await ethers.getContractFactory('LendingPoolConfigurator');
	const lendingPoolConfiguratorProxy = LendingPoolConfiguratorImpl.attach(
		await read('LendingPoolAddressesProvider', 'getLendingPoolConfigurator')
	);

	await deploy('ChefIncentivesController', {
		proxy: {
			proxyContract: 'OpenZeppelinTransparentProxy',
			execute: {
				init: {
					methodName: 'initialize',
					args: [
						lendingPoolConfiguratorProxy.address,
						edp.address,
						middleFeeDistribution.address,
						config.CIC_RPS,
					],
				},
			},
		},
	});
});
export default func;
