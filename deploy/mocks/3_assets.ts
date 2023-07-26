import {DeployStep} from '../../scripts/deploy/depfunc';
import fs from 'fs';
import {ethers} from 'hardhat';

let step = new DeployStep({
	id: 'assets',
	dependencies: ['uniswap'],
});
let func = step.setFunction(async function () {
	const {network, config} = step;

	if (network.tags.mocks) {
		const mockAssets = JSON.parse(fs.readFileSync(`./config/mock-assets.json`).toString());
		const assets = mockAssets[config.CHAIN_ID];

		for (let i = 0; i < assets.length; i += 1) {
			const [name, decimals, price] = assets[i];

			if (name !== step.baseAssetWrapped) {
				try {
					await step.deployments.get(name);
				} catch (e) {
					let mockTokenDep = await step.deploy(name, {
						contract: 'MockToken',
						args: [name, name, decimals || 18],
					});

					await step.deploy(`${name.toUpperCase()}Aggregator`, {
						contract: 'MockChainlinkAggregator',
						args: [price],
					});

					const uniswapV2Router02 = await deployments.get('UniswapV2Router02');

					let baseAmt = 1000;
					let baseValueUsd = baseAmt * step.baseAssetPrice;
					let assetPrice = price / 10 ** 8;
					let assetAmt = baseValueUsd / assetPrice;
					let ethAmt = hre.ethers.utils.parseUnits(baseAmt.toString(), 18);

					await step.execute(
						name,
						'mint',
						step.deployer,
						ethers.utils.parseUnits(assetAmt.toString(), decimals)
					);

					await step.execute(step.baseAssetWrapped, 'mint', ethAmt);

					await step.execute(
						step.baseAssetWrapped,
						'approve',
						uniswapV2Router02.address,
						ethers.constants.MaxUint256
					);
					await step.execute(name, 'approve', uniswapV2Router02.address, ethers.constants.MaxUint256);

					await step.execute(
						'UniswapV2Router02',
						'addLiquidity',
						mockTokenDep.address,
						step.weth.address,
						await step.read(name, 'balanceOf', step.deployer),
						ethAmt,
						0,
						0,
						step.deployer,
						(await ethers.provider.getBlock('latest')).timestamp * 2
					);
				}
			}
		}
	}
});
export default func;
