import {ethers} from 'hardhat';
import fs from 'fs';

async function main() {
	let addressProvider = await hre.ethers.getContract('LendingPoolAddressesProvider');

	let currentAdmin = await addressProvider.getPoolAdmin();
	console.log(`Admin:`);
	console.log(currentAdmin);

	let impersonate = true;
	let admin;
	if (impersonate) {
		// const signer2 = await hre.ethers.getSigner('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
		// const tx = await signer2.sendTransaction({
		// 	to: admin,
		// 	value: hre.ethers.utils.parseEther('1.0'),
		// });
		await hre.network.provider.request({
			method: 'hardhat_impersonateAccount',
			params: [currentAdmin],
		});
		admin = await hre.ethers.getSigner(currentAdmin);
	} else {
		admin = (await ethers.getSigners())[0];
	}

	console.log('Admin:', admin.address);
	console.log('Balance:', ethers.utils.formatEther(await admin.getBalance()));

	let configuratorAddr = await addressProvider.getLendingPoolConfigurator();

	const configurator = await ethers.getContractAt('LendingPoolConfigurator', configuratorAddr);

	let underlyingAddr = '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c';
	let stratAddr = '0x08849CA1EE738103661A04070754Fcf072437680';

	let txn = await configurator.connect(admin).setReserveInterestRateStrategyAddress(underlyingAddr, stratAddr);
	console.log(txn.hash);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
