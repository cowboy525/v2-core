import {ethers} from 'hardhat';
import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'set_lp_token',
	tags: ['core'],
	dependencies: ['lending', 'distributors'],
	runOnce: true,
});
let func = step.setFunction(async function () {
	const {get, execute, read} = step;

	const stakingAddress = await read('PoolHelper', 'lpTokenAddr');
	const leverager = await get(`Leverager`);
	const currentStakingToken = await read('MFD', 'stakingToken');

	if (currentStakingToken == '0x0000000000000000000000000000000000000000') {
		await execute('MFD', 'setLPToken', stakingAddress);
		await execute('EligibilityDataProvider', 'setLPToken', stakingAddress);

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
});
export default func;
