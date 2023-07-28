import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'uniswap',
});
let func = step.setFunction(async function () {
	const {deploy, network, weth, deployer} = step;

	if (network.tags.mocks) {
		const uniswapV2Factory = await deploy('UniswapV2Factory', {
			args: [deployer],
		});
		await deploy('UniswapV2Router02', {
			args: [uniswapV2Factory.address, weth.address],
		});
	}
});
export default func;
