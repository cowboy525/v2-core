import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction, DeployResult} from 'hardhat-deploy/types';
import {getConfigForChain} from '../../config/index';
import {LP_PROVIDER} from '../../scripts/deploy/types';
import {getWeth, wait} from '../../scripts/getDepenencies';
import {getTxnOpts} from '../../scripts/deploy/helpers/getTxnOpts';
const {ethers} = require('hardhat');

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts, ethers, network} = hre;
	const {deploy, execute, read} = deployments;
	const {deployer, dao} = await getNamedAccounts();
	const {config} = getConfigForChain(await hre.getChainId());
	const txnOpts = await getTxnOpts(hre);

	const {baseAssetWrapped} = getConfigForChain(await hre.getChainId());
	const lendingPool = await read('LendingPoolAddressesProvider', 'getLendingPool');
	let signer = await ethers.getSigner(deployer);

	const {weth} = await getWeth(hre);
	const wethAddr = weth.address;

	const radiantToken = await deployments.get('RadiantOFT');

	let poolHelper;
	let useUniswapLpProvider = config.LP_PROVIDER === LP_PROVIDER.UNISWAP;

	if (useUniswapLpProvider) {
		let router;
		if (network.tags.mocks) {
			router = (await deployments.get('UniswapV2Router02')).address;
		} else {
			router = config.ROUTER_ADDR;
		}

		const liquidityZap = await deploy('LiquidityZap', {
			...txnOpts,
			proxy: {
				proxyContract: 'OpenZeppelinTransparentProxy',
				execute: {
					methodName: 'initialize',
					args: [],
				},
			},
		});

		let phContract = 'UniswapPoolHelper';
		if (network.tags.testing) {
			phContract = 'TestUniswapPoolHelper';
		}

		poolHelper = await deploy('PoolHelper', {
			...txnOpts,
			skipIfAlreadyDeployed: true,
			contract: phContract,
			proxy: {
				proxyContract: 'OpenZeppelinTransparentProxy',
				execute: {
					methodName: 'initialize',
					args: [radiantToken.address, wethAddr, router, liquidityZap.address],
				},
			},
		});

		if (poolHelper.newlyDeployed) {
			// console.log(`WETH bal dep: ${deployer} | ${await weth.balanceOf(deployer)}`);
			// console.log(`WETH transfer: ${poolHelper.address} | ${config.LP_INIT_ETH}`);
			// await weth.connect(signer).deposit(config.LP_INIT_ETH);
			if (network.tags.mocks) {
				await execute(baseAssetWrapped, txnOpts, 'mint', config.LP_INIT_ETH);
				await execute(baseAssetWrapped, txnOpts, 'transfer', poolHelper.address, config.LP_INIT_ETH);
			} else {
				// TODO: if not enough WETH/WBNB, deposit
				await weth.connect(signer).deposit({
					value: config.LP_INIT_ETH,
				});
				await wait(10);
				console.log(`wait done`);

				await weth.connect(signer).transfer(poolHelper.address, config.LP_INIT_ETH);
				await wait(10);
				console.log(`wait done`);
			}
			// console.log(`WETH bal dep post: ${deployer} | ${await weth.balanceOf(deployer)}`);

			await execute('RadiantOFT', txnOpts, 'transfer', poolHelper.address, config.LP_INIT_RDNT);

			// console.log(await weth.balanceOf(poolHelper.address));
			// console.log(await read('RadiantOFT', 'balanceOf', poolHelper.address));

			await execute('PoolHelper', txnOpts, 'initializePool');

			const lpTokenAddr = await read('PoolHelper', {}, 'lpTokenAddr');
			await execute(
				'LiquidityZap',
				txnOpts,
				'initLiquidityZap',
				radiantToken.address,
				wethAddr,
				lpTokenAddr,
				poolHelper.address
			);
		}
	} else {
		// Balancer
		poolHelper = await deploy('PoolHelper', {
			...txnOpts,
			contract: 'BalancerPoolHelper',
			proxy: {
				proxyContract: 'OpenZeppelinTransparentProxy',
				execute: {
					init: {
						methodName: 'initialize',
						args: [
							wethAddr,
							radiantToken.address,
							wethAddr,
							config.BAL_VAULT,
							config.BAL_WEIGHTED_POOL_FACTORY,
						],
					},
				},
			},
		});

		if ((await read('PoolHelper', {}, 'lpTokenAddr')) == '0x0000000000000000000000000000000000000000') {
			console.log(`WETH bal dep: ${deployer} | ${await weth.balanceOf(deployer)}`);
			console.log(`WETH transfer: ${poolHelper.address} | ${config.LP_INIT_ETH}`);
			// await weth.connect(signer).deposit(config.LP_INIT_ETH);
			if (network.tags.mocks) {
				await execute(baseAssetWrapped, txnOpts, 'mint', config.LP_INIT_ETH);
			} else {
				await weth.connect(signer).deposit({
					value: config.LP_INIT_ETH,
				});
			}

			console.log(`WETH bal dep post: ${deployer} | ${await weth.balanceOf(deployer)}`);

			await weth.connect(signer).transfer(poolHelper.address, config.LP_INIT_ETH);
			await execute('RadiantOFT', txnOpts, 'transfer', poolHelper.address, config.LP_INIT_RDNT);

			console.log(await weth.balanceOf(poolHelper.address));
			console.log(await read('RadiantOFT', 'balanceOf', poolHelper.address));

			await execute('PoolHelper', txnOpts, 'initializePool', 'RDNT-WETH', 'RDNT-WETH');
		}
	}

	const ethLpRatio = useUniswapLpProvider ? 5000 : 2000;

	let lockzapContract = 'LockZap';
	if (hre.network.tags.mocks) {
		lockzapContract = 'TestnetLockZap';
	}

	let lockZap = await deploy('LockZap', {
		...txnOpts,
		contract: lockzapContract,
		proxy: {
			proxyContract: 'OpenZeppelinTransparentProxy',
			execute: {
				init: {
					methodName: 'initialize',
					args: [
						poolHelper.address,
						lendingPool,
						wethAddr,
						radiantToken.address,
						ethLpRatio,
						config.ZAP_SLIPPAGE_LIMIT,
					],
				},
			},
		},
	});

	if (lockZap.newlyDeployed) {
		await execute('PoolHelper', txnOpts, 'setLockZap', lockZap.address);
	}
};
export default func;
