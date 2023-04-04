import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getConfigForChain} from '../../config/index';
import {getWeth} from '../../scripts/getDepenencies';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy, execute, read} = deployments;
	const {deployer, dao, treasury} = await getNamedAccounts();
	const {config, baseAssetWrapped} = getConfigForChain(await hre.getChainId());

	const radiantToken = await deployments.get('RadiantOFT');
	const priceProvider = await deployments.get(`PriceProvider`);
	const edp = await deployments.get(`EligibilityDataProvider`);
	const chefIncentivesController = await deployments.get(`ChefIncentivesController`);
	const compounder = await deployments.get(`Compounder`);
	const multiFeeDistribution = await deployments.get(`MFD`);

	const baseAsset = (await getWeth(hre)).weth;

	let bountyManager = await deploy('BountyManager', {
		from: deployer,
		log: true,
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
						config.DQ_BOOSTER,
					],
				},
			},
		},
	});

	if (bountyManager.newlyDeployed) {
		await execute('RadiantOFT', {from: deployer}, 'transfer', bountyManager.address, config.SUPPLY_DQ_RESERVE);

		await execute('BountyManager', {from: deployer}, 'setSlippageLimit', config.slippageLimit);
		await execute('BountyManager', {from: deployer}, 'setMinStakeAmount', config.minStakeAmount);
		await execute('BountyManager', {from: deployer}, 'setBounties');

		await execute('MFD', {from: deployer}, 'setBountyManager', bountyManager.address);
		await execute('ChefIncentivesController', {from: deployer}, 'setBountyManager', bountyManager.address);
		await execute('Compounder', {from: deployer}, 'setBountyManager', bountyManager.address);

		await execute(
			'ChefIncentivesController',
			{from: deployer},
			'setEligibilityExempt',
			bountyManager.address,
			true
		);
	}
};
export default func;
func.tags = ['accessories'];
