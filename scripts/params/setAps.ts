import {ChefIncentivesController} from '../typechain';
import fs from 'fs';
import paramData from './data';

const hre = require('hardhat');
const {deployments, getNamedAccounts, network} = hre;

(async () => {
	const {get, execute, read} = deployments;
	const {deployer} = await getNamedAccounts();

	let localExecution = network.name === 'localhost';

	const data = JSON.parse(fs.readFileSync(`./deployments/${network.name}/.deployData.json`).toString());

	const allocInfo: any = paramData[network.name].aps;
	const tokens = [];
	const allocPoints = [];
	for (const key in allocInfo) {
		if (!data.allTokens[key]) {
			throw new Error(`${key} doesn't exist`);
		}
		tokens.push(data.allTokens[key]);
		allocPoints.push(allocInfo[key]);
	}

	const owner = await read('ChefIncentivesController', 'owner');
	console.log(`CIC Owner: ${owner}`);

	if (localExecution) {
		const signer2 = await hre.ethers.getSigner('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
		const tx = await signer2.sendTransaction({
			to: owner,
			value: hre.ethers.utils.parseEther('1.0'),
		});
		await hre.network.provider.request({
			method: 'hardhat_impersonateAccount',
			params: [owner],
		});
		const ownerSigner = await hre.ethers.getSigner(owner);
		const cic = <ChefIncentivesController>await hre.ethers.getContract('ChefIncentivesController');
		let res = await cic.connect(ownerSigner).batchUpdateAllocPoint(tokens, allocPoints);
		console.log(res);
	} else {
		console.log(` `);
		console.log(`===== DEFENDER PARAMS =====`);
		console.log(tokens);
		console.log(allocPoints);
		console.log(` `);
	}
})();
