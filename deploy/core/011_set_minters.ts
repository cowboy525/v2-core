import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getConfigForChain} from '../../config/index';
import {getTxnOpts} from '../../scripts/deploy/helpers/getTxnOpts';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {execute, read} = deployments;
	const {deployer, admin, vestManager, starfleet} = await getNamedAccounts();
	const {config} = getConfigForChain(await hre.getChainId());
	const txnOpts = await getTxnOpts(hre);

	const cic = await deployments.get(`ChefIncentivesController`);
	const middleFeeDistribution = await deployments.get(`MiddleFeeDistribution`);
	const mintersSet = await read('MFD', 'mintersAreSet');

	if (!mintersSet) {
		await execute('MFD', txnOpts, 'setMinters', [cic.address, middleFeeDistribution.address, vestManager]);

		await execute('MFD', txnOpts, 'setAddresses', cic.address, middleFeeDistribution.address, starfleet);
	}
};
export default func;
func.tags = ['core'];
