import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getConfigForChain} from '../../config';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
	const {deployments, getNamedAccounts, network, ethers} = hre;
	const {deploy, execute, read} = deployments;
	const {deployer, treasury, dao} = await getNamedAccounts();
	const {config} = getConfigForChain(await hre.getChainId());

	let lzEndpoint = config.LZ_ENDPOINT;

	if (network.tags.mocks) {
		await deploy('LZEndpointSrcMock', {
			contract: 'LZEndpointMock',
			from: deployer,
			log: true,
			waitConfirmations: 1,
			autoMine: true,
			skipIfAlreadyDeployed: false,
			args: [1],
		});
		const lzEndpointSrcMock = await ethers.getContract('LZEndpointSrcMock');
		lzEndpoint = lzEndpointSrcMock.address;
	}

	let rdnt = await deploy('RadiantOFT', {
		from: deployer,
		log: true,
		skipIfAlreadyDeployed: true,
		args: [config.TOKEN_NAME, config.SYMBOL, lzEndpoint, dao, treasury, config.MINT_AMT],
	});

	if (rdnt.newlyDeployed) {
		await execute('RadiantOFT', {from: deployer, log: true}, 'setFee', config.FEE_BRIDGING);
	}

	let rdntRequired = config.LP_INIT_RDNT.add(config.SUPPLY_CIC_RESERVE).add(config.SUPPLY_DQ_RESERVE);

	if (!!config.SUPPLY_MIGRATION_MINT) {
		rdntRequired = rdntRequired.add(config.SUPPLY_MIGRATION_MINT);
	}

	console.log(`=== Deployer will need RDNT: `, ethers.utils.formatEther(rdntRequired));
	console.log(`Has: ${await read('RadiantOFT', 'balanceOf', deployer)}`);
	console.log(`DAO Has: ${await read('RadiantOFT', 'balanceOf', dao)}`);

	if (network.tags.testing) {
		await execute('RadiantOFT', {from: dao}, 'transfer', deployer, rdntRequired);
	}
};
func.tags = ['rdnt44'];
export default func;
