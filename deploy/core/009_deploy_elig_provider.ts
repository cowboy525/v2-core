import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getConfigForChain} from '../../config/index';
import {getTxnOpts} from '../../scripts/deploy/helpers/getTxnOpts';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy, execute, read} = deployments;
	const {deployer} = await getNamedAccounts();
	const {config} = getConfigForChain(await hre.getChainId());
	const txnOpts = await getTxnOpts(hre);

	const priceProvider = await deployments.get(`PriceProvider`);
	const lendingPool = await read('LendingPoolAddressesProvider', 'getLendingPool');
	const middleFeeDistribution = await deployments.get(`MiddleFeeDistribution`);

	const edp = await deploy('EligibilityDataProvider', {
		...txnOpts,
		proxy: {
			proxyContract: 'OpenZeppelinTransparentProxy',
			execute: {
				init: {
					methodName: 'initialize',
					args: [lendingPool, middleFeeDistribution.address, priceProvider.address],
				},
			},
		},
	});

	if (edp.newlyDeployed) {
		await execute('EligibilityDataProvider', txnOpts, 'setRequiredDepositRatio', config.P2P_RATIO);
	}
};
export default func;
func.tags = ['core'];
