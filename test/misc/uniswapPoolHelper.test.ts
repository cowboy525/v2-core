import hre, {ethers, upgrades} from 'hardhat';
import {UniswapPoolHelper} from '../../typechain';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
chai.use(solidity);
const {expect} = chai;

describe('Uniswap Pool Helper', function () {
	it('Only owner can initialize', async () => {
		const [deverloper, dao] = await ethers.getSigners();
		const poolHelperFactory = await ethers.getContractFactory('UniswapPoolHelper');
		// Deploy
		const newPoolHelper = <UniswapPoolHelper>await upgrades.deployProxy(
			poolHelperFactory,
			//No need to set reasonable values, as we won't reach far enough for them to be used
			[deverloper.address, deverloper.address, deverloper.address, deverloper.address],
			{initializer: 'initialize', unsafeAllow: ['constructor']}
		);

		await expect(newPoolHelper.connect(dao).initializePool()).to.be.revertedWith(
			'Ownable: caller is not the owner'
		);
	});
});
