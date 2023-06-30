import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getConfigForChain} from '../../config/index';
import {getTxnOpts} from '../../scripts/deploy/helpers/getTxnOpts';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy, execute} = deployments;
	const {deployer, treasury, dao} = await getNamedAccounts();
	const {config, baseAssetWrapped} = getConfigForChain(await hre.getChainId());
	const txnOpts = await getTxnOpts(hre);

	let radiantToken = await deployments.get('RadiantOFT');
	let priceProvider = await deployments.get(`PriceProvider`);
	let lockZap = await deployments.get(`LockZap`);
	let aaveOracle = await deployments.get('AaveOracle');
	const dataProvider = await deployments.get('AaveProtocolDataProvider');

	const lockerList = await deploy('LockerList', {
		...txnOpts,
		contract: 'LockerList',
	});

	const mfd = await deploy('MFD', {
		...txnOpts,
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
		...txnOpts,
		proxy: {
			proxyContract: 'OpenZeppelinTransparentProxy',
			execute: {
				init: {
					methodName: 'initialize',
					args: [radiantToken.address, aaveOracle.address, mfd.address, dataProvider.address],
				},
			},
		},
	});

	if (mfd.newlyDeployed) {
		await execute('LockerList', txnOpts, 'transferOwnership', mfd.address);
		await execute('MiddleFeeDistribution', txnOpts, 'setOperationExpenses', treasury, config.OPEX_RATIO);
		await execute('LockZap', txnOpts, 'setMfd', mfd.address);
		await execute('MFD', txnOpts, 'setLockTypeInfo', config.LOCK_INFO.LOCK_PERIOD, config.LOCK_INFO.MULTIPLIER);
	}
};
export default func;
func.tags = ['mfd_upgrade'];
