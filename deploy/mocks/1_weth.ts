import {ethers} from 'hardhat';
import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'weth',
});
let func = step.setFunction(async function () {
	const {deploy, execute, network, baseAssetWrapped} = step;

	if (network.tags.mocks) {
		const weth = await deploy(baseAssetWrapped);

		if (weth.newlyDeployed) {
			await execute(baseAssetWrapped, 'mint', ethers.utils.parseEther('100000000'));
		}

		await deploy(`${baseAssetWrapped.toUpperCase()}Aggregator`, {
			contract: 'MockChainlinkAggregator',
			args: [hre.ethers.utils.parseUnits(step.baseAssetPrice.toString(), 8)],
		});
	}
});
export default func;
