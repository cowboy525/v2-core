import {ethers} from 'hardhat';
import {DeployStep} from '../../scripts/deploy/depfunc';
import {LP_PROVIDER} from '../../scripts/deploy/types';

let step = new DeployStep({
	id: 'configure_lp',
	tags: ['core'],
	dependencies: ['weth', 'token', 'deploy_lp'],
	runOnce: true,
});
let func = step.setFunction(async function () {
	const {read, config, network, weth, execute, deployer, baseAssetWrapped} = step;

	const poolHelper = await deployments.get('PoolHelper');
	const radiantToken = await deployments.get('RadiantOFT');

	let signer = await ethers.getSigner(deployer);
	let useUniswapLpProvider = config.LP_PROVIDER === LP_PROVIDER.UNISWAP;

	const poolHelperInitialized =
		(await read('PoolHelper', 'lpTokenAddr')) != '0x0000000000000000000000000000000000000000';

	// TODO: deduplicate logic, clean up
	if (!poolHelperInitialized) {
		if (useUniswapLpProvider) {
			// console.log(`WETH bal dep: ${deployer} | ${await weth.balanceOf(deployer)}`);
			// console.log(`WETH transfer: ${poolHelper.address} | ${config.LP_INIT_ETH}`);
			// await weth.connect(signer).deposit(config.LP_INIT_ETH);
			if (network.tags.mocks) {
				await execute(baseAssetWrapped, 'mint', config.LP_INIT_ETH);
				await execute(baseAssetWrapped, 'transfer', poolHelper.address, config.LP_INIT_ETH);
			} else {
				// TODO: if not enough WETH/WBNB, deposit
				await weth.connect(signer).deposit({
					value: config.LP_INIT_ETH,
				});
				await weth.connect(signer).transfer(poolHelper.address, config.LP_INIT_ETH);
			}
			// console.log(`WETH bal dep post: ${deployer} | ${await weth.balanceOf(deployer)}`);

			await execute('RadiantOFT', 'transfer', poolHelper.address, config.LP_INIT_RDNT);

			// console.log(await weth.balanceOf(poolHelper.address));
			// console.log(await read('RadiantOFT', 'balanceOf', poolHelper.address));

			await execute('PoolHelper', 'initializePool');

			const lpTokenAddr = await read('PoolHelper', 'lpTokenAddr');
			await execute(
				'LiquidityZap',
				'initLiquidityZap',
				radiantToken.address,
				weth.address,
				lpTokenAddr,
				poolHelper.address
			);
			await execute('LiquidityZap', 'setAcceptableRatio', config.ZAP_SLIPPAGE_LIMIT);
		} else {
			console.log(`WETH bal dep: ${deployer} | ${await weth.balanceOf(deployer)}`);
			console.log(`WETH transfer: ${poolHelper.address} | ${config.LP_INIT_ETH}`);
			// await weth.connect(signer).deposit(config.LP_INIT_ETH);
			if (network.tags.mocks) {
				await execute(baseAssetWrapped, 'mint', config.LP_INIT_ETH);
			} else {
				await weth.connect(signer).deposit({
					value: config.LP_INIT_ETH,
				});
			}

			console.log(`WETH bal dep post: ${deployer} | ${await weth.balanceOf(deployer)}`);

			await weth.connect(signer).transfer(poolHelper.address, config.LP_INIT_ETH);
			await execute('RadiantOFT', 'transfer', poolHelper.address, config.LP_INIT_RDNT);

			console.log(await weth.balanceOf(poolHelper.address));
			console.log(await read('RadiantOFT', 'balanceOf', poolHelper.address));

			await execute('PoolHelper', 'initializePool', 'RDNT-WETH', 'RDNT-WETH');
		}
	}
});
export default func;
