import {ChefIncentivesController} from '../typechain';
import fs from 'fs';

const hre = require('hardhat');
const {deployments, getNamedAccounts, network} = hre;

(async () => {
	const {get, execute, read} = deployments;
	const {deployer} = await getNamedAccounts();

	const owner = await read('ChefIncentivesController', 'owner');
	console.log(`CIC Owner: ${owner}`);

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

	const data = JSON.parse(fs.readFileSync('./deployments/localhost/.deployData.json').toString());

	const allocInfo: {[key: string]: number} = {
		rBTCB: 30,
		vdBTCB: 45,
		rUSDT: 25,
		vdUSDT: 37,
		rBUSD: 8,
		vdBUSD: 12,
		rUSDC: 3,
		vdUSDC: 5,
		rETH: 6,
		vdETH: 9,
		rWBNB: 70,
		vdWBNB: 70,
	};
	const tokens = [];
	const allocPoints = [];
	for (const key in allocInfo) {
		if (!data.allTokens[key]) {
			console.log(key, "doesn't exist");
			return;
		}
		tokens.push(data.allTokens[key]);
		allocPoints.push(allocInfo[key]);
	}

	console.log(tokens);
	console.log(allocPoints);

	const receipt = await cic.connect(ownerSigner).batchUpdateAllocPoint(tokens, allocPoints);
	await receipt.wait();
	console.log('Allocation points updated!');
})();
