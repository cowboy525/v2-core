import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getWeth} from '../../scripts/getDepenencies';
import {getTxnOpts} from '../../scripts/deploy/helpers/getTxnOpts';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy, execute, read} = deployments;
	const txnOpts = await getTxnOpts(hre);

	let poolHelper = await deployments.get('PoolHelper');
	const {chainlinkEthUsd} = await getWeth(hre);

	const pp = await deploy('PriceProvider', {
		...txnOpts,
		proxy: {
			proxyContract: 'OpenZeppelinTransparentProxy',
			execute: {
				init: {
					methodName: 'initialize',
					args: [chainlinkEthUsd, poolHelper.address],
				},
			},
		},
	});

	if (pp.newlyDeployed) {
		await execute('RadiantOFT', txnOpts, 'setPriceProvider', pp.address);
		await execute('LockZap', txnOpts, 'setPriceProvider', pp.address);
	}
};
export default func;
func.tags = ['core'];
