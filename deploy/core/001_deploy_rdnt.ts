import {ethers} from 'hardhat';
import {DeployStep} from '../../scripts/deploy/depfunc';

let step = new DeployStep({
	id: 'deploy_token',
	tags: ['token', 'core'],
	dependencies: ['weth', 'uniswap', 'layerzero'],
});
let func = step.setFunction(async function () {
	const {deploy, config, network, dao, treasury, execute, executeFrom, deployer} = step;

	let lzEndpoint = config?.LZ_ENDPOINT;
	if (network.tags.mocks) {
		lzEndpoint = (await ethers.getContract('LZEndpointSrcMock')).address;
	}

	const rdnt = await deploy('RadiantOFT', {
		args: [config?.TOKEN_NAME, config?.SYMBOL, lzEndpoint, dao, treasury, config?.MINT_AMT],
	});

	let rdntRequired = config.LP_INIT_RDNT.add(config.SUPPLY_CIC_RESERVE).add(config.SUPPLY_DQ_RESERVE);

	if (!!config.SUPPLY_MIGRATION_MINT) {
		rdntRequired = rdntRequired.add(config.SUPPLY_MIGRATION_MINT);
	}

	// console.log(`=== Deployer will need RDNT: `, ethers.utils.formatEther(rdntRequired));
	// console.log(`Has: ${await read('RadiantOFT', 'balanceOf', deployer)}`);
	// console.log(`DAO Has: ${await read('RadiantOFT', 'balanceOf', dao)}`);

	if (rdnt.newlyDeployed) {
		await execute('RadiantOFT', 'setFeeRatio', config.FEE_BRIDGING);
		if (network.tags.testing) {
			// TODO: from DAO
			await executeFrom('RadiantOFT', dao, 'transfer', deployer, rdntRequired);
		}
	}
});
export default func;
