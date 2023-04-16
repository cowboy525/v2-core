import fs from 'fs';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getDependency} from '../../scripts/getDepenencies';
import {getConfigForChain} from '../../config/index';
import {LendingPool} from '../../typechain';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts, network, ethers} = hre;
	const {deploy, execute, read} = deployments;
	const {deployer} = await getNamedAccounts();
	const {config, baseAssetWrapped} = getConfigForChain(await hre.getChainId());

	if (network.tags.mocks) {
		const formattedAmt = ethers.utils.parseUnits('100000', 18);
		let weth = await deployments.get(baseAssetWrapped);

		await execute(baseAssetWrapped, {from: deployer}, 'mint', formattedAmt);

		const lendingPoolAddr = await read('LendingPoolAddressesProvider', 'getLendingPool');
		const lendingPool = <LendingPool>await ethers.getContractAt('LendingPool', lendingPoolAddr);

		await execute(baseAssetWrapped, {from: deployer}, 'approve', lendingPool.address, ethers.constants.MaxUint256);
		await (await lendingPool.deposit(weth.address, formattedAmt, deployer, 0)).wait();

		const mockAssets = JSON.parse(fs.readFileSync(`./config/mock-assets.json`).toString());
		const assets = mockAssets[config.CHAIN_ID];

		for (let i = 0; i < assets.length; i += 1) {
			const [name, decimals, price] = assets[i];
			if (name !== baseAssetWrapped) {
				let token = await ethers.getContract(name);
				let amt =
					name === 'WETH' || name === 'WBTC' || name === 'WSTETH'
						? ethers.utils.parseUnits('100', decimals)
						: ethers.utils.parseUnits('200000000', decimals);

				await execute(name, {from: deployer, log: true}, 'mint', deployer, amt.mul(2));
				await execute(name, {from: deployer}, 'approve', lendingPool.address, ethers.constants.MaxUint256);
				await (await lendingPool.deposit(token.address, amt, deployer, 0)).wait();
				await new Promise((res, rej) => {
					setTimeout(res, 5 * 1000);
				});
			}
		}
	}
};
export default func;
func.tags = ['populate'];
