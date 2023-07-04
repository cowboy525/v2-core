import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getConfigForChain} from '../../config/index';
import {getWeth} from '../../scripts/getDepenencies';
import {getTxnOpts} from '../../scripts/deploy/helpers/getTxnOpts';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy, execute, read} = deployments;
	const {deployer, dao, treasury} = await getNamedAccounts();
	const {config, baseAssetWrapped} = getConfigForChain(await hre.getChainId());
	const txnOpts = await getTxnOpts(hre);

	const radiantToken = await deployments.get('RadiantOFT');
	const priceProvider = await deployments.get(`PriceProvider`);
	const edp = await deployments.get(`EligibilityDataProvider`);
	const chefIncentivesController = await deployments.get(`ChefIncentivesController`);
	const compounder = await deployments.get(`Compounder`);
	const multiFeeDistribution = await deployments.get(`MFD`);

	const baseAsset = (await getWeth(hre)).weth;

	let bountyManager = await deploy('BountyManager', {
		...txnOpts,
		proxy: {
			proxyContract: 'OpenZeppelinTransparentProxy',
			execute: {
				init: {
					methodName: 'initialize',
					args: [
						radiantToken.address,
						baseAsset.address,
						multiFeeDistribution.address,
						chefIncentivesController.address,
						priceProvider.address,
						edp.address,
						compounder.address,
						config.DQ_HUNTER_SHARE,
						config.DQ_TARGET_BASE_BOUNTY_USD,
						config.DQ_MAX_BASE_BOUNTY,
					],
				},
			},
		},
	});

	if (bountyManager.newlyDeployed) {
		await execute('RadiantOFT', txnOpts, 'transfer', bountyManager.address, config.SUPPLY_DQ_RESERVE);

		await execute('BountyManager', txnOpts, 'setMinStakeAmount', config.MIN_STAKE_AMT);
		await execute('BountyManager', txnOpts, 'setBounties');

		await execute('MFD', txnOpts, 'setBountyManager', bountyManager.address);
		await execute('ChefIncentivesController', txnOpts, 'setBountyManager', bountyManager.address);
		await execute('Compounder', txnOpts, 'setBountyManager', bountyManager.address);

		await execute('ChefIncentivesController', txnOpts, 'setEligibilityExempt', bountyManager.address, true);
	}
};
export default func;
func.tags = ['accessories'];
