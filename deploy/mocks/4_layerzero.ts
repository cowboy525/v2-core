import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'layerzero',
});
let func = step.setFunction(async function () {
	const {deploy, network} = step;

	if (network.tags.mocks) {
		await deploy('LZEndpointSrcMock', {
			contract: 'LZEndpointMock',
			args: [1],
		});
	}
});
export default func;
