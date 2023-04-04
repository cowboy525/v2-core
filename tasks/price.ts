import {ComboOracle, ManualOracle, UniV3TwapOracle} from '../typechain';

const hre = require('hardhat');
const {deployments, getNamedAccounts} = hre;

(async () => {
	const oracle1 = <UniV3TwapOracle>await hre.ethers.getContract('UniV3TwapOracle');
	const oracle2 = <UniV3TwapOracle>await hre.ethers.getContract('Uni-V3-2');
	const oracle3 = <ManualOracle>await hre.ethers.getContract('ManualOracle');
	const oracle4 = <ComboOracle>await hre.ethers.getContract('ComboOracle');

	setInterval(async () => {
		try {
			console.table({
				'Oracle 1': hre.ethers.utils.formatUnits(await oracle1.latestAnswer(), 8),
				'Oracle 2': hre.ethers.utils.formatUnits(await oracle2.latestAnswer(), 8),
				'Oracle 3': hre.ethers.utils.formatUnits(await oracle3.latestAnswer(), 8),
				Combo: hre.ethers.utils.formatUnits(await oracle4.latestAnswer(), 8),
			});
		} catch (e) {}
		console.log(' ');

		// console.log(`ETH: ${hre.ethers.utils.formatUnits(await oracle.latestAnswerInEth(), 8)}`);
	}, 10 * 1000);
})();
