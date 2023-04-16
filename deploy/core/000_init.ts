import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getConfigForChain} from '../../config';
import {getDependency} from '../../scripts/getDepenencies';
import {setNonce} from '@nomicfoundation/hardhat-network-helpers';
import fs from 'fs';
import {getTxnOpts} from '../../scripts/deploy/helpers/getTxnOpts';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const {deployments, getNamedAccounts, network, ethers} = hre;
	const {deploy, execute, read} = deployments;
	const {deployer, treasury, dao} = await getNamedAccounts();
	const {config} = getConfigForChain(await hre.getChainId());
	const txnOpts = await getTxnOpts(hre);

	if (hre.network.tags.mocks) {
		const {baseAssetWrapped} = getConfigForChain(await hre.getChainId());
		const baseAssetPrice = baseAssetWrapped === 'WBNB' ? 300 : 2100;

		const weth = await deploy(baseAssetWrapped, txnOpts);
		await deploy(`${baseAssetWrapped.toUpperCase()}Aggregator`, {
			...txnOpts,
			contract: 'MockChainlinkAggregator',
			args: [hre.ethers.utils.parseUnits(baseAssetPrice.toString(), 8)],
		});

		const uniswapV2Factory = await deploy('UniswapV2Factory', {
			...txnOpts,
			args: [deployer],
		});

		await deploy('UniswapV2Router02', {
			...txnOpts,
			args: [uniswapV2Factory.address, weth.address],
		});

		await execute(baseAssetWrapped, txnOpts, 'mint', hre.ethers.utils.parseEther('100000000'));

		const mockAssets = JSON.parse(fs.readFileSync(`./config/mock-assets.json`).toString());
		const assets = mockAssets[config.CHAIN_ID];

		for (let i = 0; i < assets.length; i += 1) {
			const [name, decimals, price] = assets[i];

			if (name !== baseAssetWrapped) {
				try {
					await deployments.get(name);
				} catch (e) {
					let mockTokenDep = await deploy(name, {
						...txnOpts,
						contract: 'MockToken',
						args: [name, name, decimals || 18],
					});

					await deploy(`${name.toUpperCase()}Aggregator`, {
						...txnOpts,
						contract: 'MockChainlinkAggregator',
						args: [price],
					});

					const uniswapV2Router02 = await deployments.get('UniswapV2Router02');

					let baseAmt = 1000;
					let baseValueUsd = baseAmt * baseAssetPrice;
					let assetPrice = price / 10 ** 8;
					let assetAmt = baseValueUsd / assetPrice;
					let ethAmt = ethers.utils.parseUnits(baseAmt.toString(), 18);

					await execute(
						name,
						txnOpts,
						'mint',
						deployer,
						ethers.utils.parseUnits(assetAmt.toString(), decimals)
					);
					await execute(baseAssetWrapped, {from: deployer, log: true}, 'mint', ethAmt);

					await execute(
						baseAssetWrapped,
						txnOpts,
						'approve',
						uniswapV2Router02.address,
						ethers.constants.MaxUint256
					);
					await execute(name, txnOpts, 'approve', uniswapV2Router02.address, ethers.constants.MaxUint256);

					await execute(
						'UniswapV2Router02',
						txnOpts,
						'addLiquidity',
						mockTokenDep.address,
						weth.address,
						await read(name, 'balanceOf', deployer),
						ethAmt,
						0,
						0,
						deployer,
						(await ethers.provider.getBlock('latest')).timestamp * 2
					);
				}
			}
		}
	}
};
// func.tags = ['RadiantOFT'];
// func.dependencies = ['dependencies'];
// func.tags = ['rdnt44'];
export default func;
