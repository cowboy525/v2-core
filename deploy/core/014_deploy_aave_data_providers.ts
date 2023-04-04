import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getConfigForChain} from '../../config/index';
import {getWeth} from '../../scripts/getDepenencies';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts, network} = hre;
	const {deploy} = deployments;
	const {deployer} = await getNamedAccounts();
	const {baseAssetWrapped, config} = getConfigForChain(await hre.getChainId());

	const chefIncentivesController = await deployments.get(`ChefIncentivesController`);
	const aaveOracle = await deployments.get(`AaveOracle`);

	const {chainlinkEthUsd} = await getWeth(hre);

	await deploy('WalletBalanceProvider', {
		from: deployer,
		log: true,
	});

	await deploy('UiPoolDataProvider', {
		from: deployer,
		log: true,
		args: [chefIncentivesController.address, aaveOracle.address],
	});

	await deploy('UiPoolDataProviderV2V3', {
		from: deployer,
		log: true,
		args: [chainlinkEthUsd, chainlinkEthUsd],
	});
};
export default func;
func.tags = ['core'];
