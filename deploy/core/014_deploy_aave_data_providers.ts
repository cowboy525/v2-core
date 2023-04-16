import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getConfigForChain} from '../../config/index';
import {getWeth} from '../../scripts/getDepenencies';
import {getTxnOpts} from '../../scripts/deploy/helpers/getTxnOpts';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts, network} = hre;
	const {deploy} = deployments;
	const {deployer} = await getNamedAccounts();
	const {baseAssetWrapped, config} = getConfigForChain(await hre.getChainId());
	const txnOpts = await getTxnOpts(hre);

	const chefIncentivesController = await deployments.get(`ChefIncentivesController`);
	const aaveOracle = await deployments.get(`AaveOracle`);

	const {chainlinkEthUsd} = await getWeth(hre);

	await deploy('WalletBalanceProvider', txnOpts);

	await deploy('UiPoolDataProvider', {
		...txnOpts,
		args: [chefIncentivesController.address, aaveOracle.address],
	});

	await deploy('UiPoolDataProviderV2V3', {
		...txnOpts,
		args: [chainlinkEthUsd, chainlinkEthUsd],
	});
};
export default func;
func.tags = ['core'];
