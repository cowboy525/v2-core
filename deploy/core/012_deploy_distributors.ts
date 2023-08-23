import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'deploy_distributors',
	tags: ['core'],
	dependencies: ['configure_lp'],
});
let func = step.setFunction(async function () {
	const {deploy, config, dao, get} = step;

	const radiantToken = await get('RadiantOFT');
	const lockZap = await get('LockZap');
	const priceProvider = await get('PriceProvider');
	const aaveOracle = await get('AaveOracle');
	const dataProvider = await get('AaveProtocolDataProvider');

	const mfd = await deploy('MFD', {
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

	await deploy('MiddleFeeDistribution', {
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
});
export default func;
