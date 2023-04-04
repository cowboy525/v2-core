import hre, {ethers} from 'hardhat';
import fs from 'fs';

async function main() {
	const data = JSON.parse(fs.readFileSync('./deployments/arbitrum/.deployData.json').toString());
	const allocInfo: {[key: string]: number} = {
		rWBTC: 2,
		vdWBTC: 4,
		rWETH: 25,
		vdWETH: 25,
		rUSDC: 22,
		vdUSDC: 44,
		rUSDT: 6,
		vdUSDT: 12,
		rDAI: 4,
		vdDAI: 8,
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
	const chefIncentivesController = await ethers.getContractAt(
		'ChefIncentivesController',
		data.chefIncentivesController
	);

	const receipt = await chefIncentivesController.batchUpdateAllocPoint(tokens, allocPoints);

	await receipt.wait();
	console.log('Allocation points updated!');
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
