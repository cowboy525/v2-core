import {ethers} from 'hardhat';
import {DeployStep} from '../../scripts/deploy/depfunc';
import {LendingPool} from '../../typechain';
import fs from 'fs';

let step = new DeployStep({
	id: 'mock_markets',
	dependencies: ['core', 'post_assets'],
	runOnce: true,
});
let func = step.setFunction(async function () {
	const {network, weth, baseAssetWrapped, execute, read, deployer, config} = step;

	if (network.tags.mocks) {
		const formattedAmt = ethers.utils.parseUnits('100000', 18);

		await execute(baseAssetWrapped, 'mint', formattedAmt);

		const lendingPoolAddr = await read('LendingPoolAddressesProvider', 'getLendingPool');
		const lendingPool = <LendingPool>await ethers.getContractAt('LendingPool', lendingPoolAddr);

		await execute(baseAssetWrapped, 'approve', lendingPool.address, ethers.constants.MaxUint256);
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

				await execute(name, 'mint', deployer, amt.mul(2));
				await execute(name, 'approve', lendingPool.address, ethers.constants.MaxUint256);
				await (await lendingPool.deposit(token.address, amt, deployer, 0)).wait();
				await new Promise((res, rej) => {
					setTimeout(res, 1 * 1000);
				});
			}
		}
	}
});
export default func;
