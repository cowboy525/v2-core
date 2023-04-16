import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
const {ethers} = require('hardhat');
import {getConfigForChain} from '../../config/index';
import {getTxnOpts} from '../../scripts/deploy/helpers/getTxnOpts';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {execute, read} = deployments;
	const {deployer} = await getNamedAccounts();
	const txnOpts = await getTxnOpts(hre);

	const stakingAddress = await read('PoolHelper', 'lpTokenAddr');
	const priceProvider = await deployments.get(`PriceProvider`);
	const leverager = await deployments.get(`Leverager`);
	const currentStakingToken = await read('MFD', {}, 'stakingToken');

	if (currentStakingToken == '0x0000000000000000000000000000000000000000') {
		await execute('MFD', txnOpts, 'setLPToken', stakingAddress);
		await execute('EligibilityDataProvider', txnOpts, 'setLPToken', stakingAddress);

		const libraries = {
			'contracts/lending/libraries/logic/ValidationLogic.sol:ValidationLogic': (
				await deployments.get('ValidationLogic')
			).address,
			'contracts/lending/libraries/logic/ReserveLogic.sol:ReserveLogic': (await deployments.get('ReserveLogic'))
				.address,
		};

		const lendingPool = await read('LendingPoolAddressesProvider', 'getLendingPool');
		const LendingPoolImpl = await ethers.getContractFactory('LendingPool', {
			libraries,
		});
		const LendingPoolProxy = LendingPoolImpl.attach(lendingPool);
		await (await LendingPoolProxy.setLeverager(leverager.address)).wait();
	}
};
export default func;
func.tags = ['core'];
