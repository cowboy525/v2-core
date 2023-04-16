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

	const baseAsset = (await getWeth(hre)).weth;
	const lockZap = await deployments.get(`LockZap`);
	const edp = await deployments.get(`EligibilityDataProvider`);
	const aaveOracle = await deployments.get(`AaveOracle`);
	const wethGateway = await deployments.get(`WETHGateway`);
	const cic = await deployments.get(`ChefIncentivesController`);
	const lendingPool = await read('LendingPoolAddressesProvider', 'getLendingPool');

	await deploy('Multicall', txnOpts);

	let leverager = await deploy('Leverager', {
		...txnOpts,
		args: [
			lendingPool,
			edp.address,
			aaveOracle.address,
			lockZap.address,
			cic.address,
			baseAsset.address,
			config.FEE_LOOPING,
			treasury,
		],
	});

	if (leverager.newlyDeployed) {
		await execute('ChefIncentivesController', txnOpts, 'setLeverager', leverager.address);
	}

	let sgBorrow = await deploy('StargateBorrow', {
		...txnOpts,
		proxy: {
			proxyContract: 'OpenZeppelinTransparentProxy',
			execute: {
				init: {
					methodName: 'initialize',
					args: [
						config.STARGATE_ROUTER,
						config.STARGATE_ROUTER_ETH,
						lendingPool,
						baseAsset.address,
						treasury,
						config.FEE_XCHAIN_BORROW,
					],
				},
			},
		},
	});

	if (sgBorrow.newlyDeployed) {
		const assets = config.STARGATE_CONFIG.ASSETS;
		const poolIds = config.STARGATE_CONFIG.POOL_IDS;
		await execute('StargateBorrow', {from: deployer}, 'setPoolIDs', assets, poolIds);
	}
};
export default func;
func.tags = ['accessories'];
