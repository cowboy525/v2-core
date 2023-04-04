import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getConfigForChain} from '../../config/index';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy, execute} = deployments;
	const {deployer, treasury, dao} = await getNamedAccounts();
	const {config, baseAssetWrapped} = getConfigForChain(await hre.getChainId());

	let radiantToken = await deployments.get('RadiantOFT');
	let priceProvider = await deployments.get(`PriceProvider`);
	let lockZap = await deployments.get(`LockZap`);
	let aaveOracle = await deployments.get('AaveOracle');

	const lockerList = await deploy('LockerList', {
		contract: 'LockerList',
		from: deployer,
		log: true,
	});

	const mfd = await deploy('MFD', {
		from: deployer,
		log: true,
		contract: 'MultiFeeDistribution',
		proxy: {
			proxyContract: 'OpenZeppelinTransparentProxy',
			execute: {
				init: {
					methodName: 'initialize',
					args: [
						radiantToken.address,
						lockZap.address,
						dao,
						lockerList.address,
						priceProvider.address,
						config.MFD_REWARD_DURATION_SECS,
						config.MFD_REWARD_LOOKBACK_SECS,
						config.MFD_LOCK_DURATION_SECS,
						config.STARFLEET_RATIO,
						config.MFD_VEST_DURATION,
					],
				},
			},
		},
	});

	const middleFee = await deploy('MiddleFeeDistribution', {
		from: deployer,
		log: true,
		proxy: {
			proxyContract: 'OpenZeppelinTransparentProxy',
			execute: {
				init: {
					methodName: 'initialize',
					args: [radiantToken.address, aaveOracle.address, mfd.address],
				},
			},
		},
	});

	if (mfd.newlyDeployed) {
		await execute('LockerList', {from: deployer, log: true}, 'transferOwnership', mfd.address);
		await execute(
			'MiddleFeeDistribution',
			{from: deployer, log: true},
			'setOperationExpenses',
			treasury,
			config.OPEX_RATIO
		);
		await execute('LockZap', {from: deployer, log: true}, 'setMfd', mfd.address);
		await execute(
			'MFD',
			{from: deployer, log: true},
			'setLockTypeInfo',
			config.LOCK_INFO.LOCK_PERIOD,
			config.LOCK_INFO.MULTIPLIER
		);
	}
};
export default func;
func.tags = ['mfd_upgrade'];
