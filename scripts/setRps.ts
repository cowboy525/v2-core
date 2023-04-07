import {ChefIncentivesController} from '../typechain';

const hre = require('hardhat');
const {deployments, getNamedAccounts, network} = hre;

(async () => {
	const {get, execute, read} = deployments;
	const {deployer} = await getNamedAccounts();

	const rps = hre.ethers.utils.parseEther('3.638299912');
	console.log(`New RPS: ${rps}`);
	const owner = await read('ChefIncentivesController', 'owner');
	console.log(`CIC Owner: ${owner}`);

	// const signer2 = await hre.ethers.getSigner('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
	// const tx = await signer2.sendTransaction({
	// 	to: owner,
	// 	value: hre.ethers.utils.parseEther('1.0'),
	// });

	await hre.network.provider.request({
		method: 'hardhat_impersonateAccount',
		params: [owner],
	});
	const ownerSigner = await hre.ethers.getSigner(owner);

	const cic = <ChefIncentivesController>await hre.ethers.getContract('ChefIncentivesController');

	let res = await cic.connect(ownerSigner).setRewardsPerSecond(rps, true);
	console.log(res);
	// await execute('ChefIncentivesController', {from: owner, log: true}, 'setRewardsPerSecond', rps, true);
})();
