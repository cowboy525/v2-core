import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
import {ethers, upgrades} from 'hardhat';
import {DeployConfig} from '../../scripts/deploy/types';
import {AaveProtocolDataProvider, CustomERC20, MiddleFeeDistribution, MultiFeeDistribution} from '../../typechain';
import {setupTest} from '../setup';

chai.use(solidity);
const {expect} = chai;

let config: DeployConfig;

describe('MiddleFeeDistribution', () => {
	let deployer: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let mfd: MultiFeeDistribution;
	let middle: MiddleFeeDistribution;
	let radiant: CustomERC20;
	let lp: CustomERC20;

	const amount = ethers.utils.parseUnits('10000000', 18);
	const mintAmount = ethers.utils.parseUnits('604800', 18);

	beforeEach(async () => {
		[deployer, user1, user2] = await ethers.getSigners();

		const fixture = await setupTest();

		radiant = fixture.rdntToken;
		mfd = fixture.multiFeeDistribution;
		middle = fixture.middleFeeDistribution;
		config = fixture.deployConfig;

		lp = await ethers.getContractAt('CustomERC20', await mfd.stakingToken());
	});
	describe('remove rewards with mock deployment', () => {
		it('reward token arrays are adjusted accordingly', async () => {
			const rewardToken1 = await mfd.rewardTokens(1);
			expect(await middle.isRewardToken(rewardToken1)).to.be.eq(true);
			await middle.removeReward(rewardToken1);
			expect(await middle.isRewardToken(rewardToken1)).to.be.eq(false);
			const previouslyLastRewardToken = await mfd.rewardTokens(1);
			expect(previouslyLastRewardToken).to.not.be.eq(rewardToken1);
		});
	});
});

// Test with mock ownership
describe('MiddleFeeDistribution with mock deployment', () => {
	let deployer: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let mfd: SignerWithAddress;
	let middle: any;
	let radiant: CustomERC20;
	let lp: CustomERC20;

	const amount = ethers.utils.parseUnits('10000000', 18);
	const MFD_REWARD_DURATION_SECS = 60;
	const MFD_REWARD_LOOKBACK_SECS = 30;
	const MFD_LOCK_DURATION_SECS = 2400;

	const mintAmount = ethers.utils.parseUnits('604800', 18);

	beforeEach(async () => {
		[deployer, user1, user2, mfd] = await ethers.getSigners();

		const erc20Factory = await ethers.getContractFactory('CustomERC20');
		radiant = <CustomERC20>await erc20Factory.deploy(amount);
		lp = <CustomERC20>await erc20Factory.deploy(amount);

		await radiant.transfer(user1.address, amount.div(10));
		await radiant.transfer(user2.address, amount.div(10));
		await lp.transfer(user1.address, amount.div(10));
		await lp.transfer(user2.address, amount.div(10));

		const mockPriceProviderFactory = await ethers.getContractFactory('MockPriceProvider');

		const aaveOracle = await ethers.getContractFactory('AaveOracle');

		const priceProvider = await mockPriceProviderFactory.deploy();
		await priceProvider.deployed();

		const middleFactory = await ethers.getContractFactory('MiddleFeeDistribution');
		middle = await upgrades.deployProxy(
			middleFactory,
			[radiant.address, mfd.address, mfd.address, mfd.address], //middle should be aaveoracle
			{initializer: 'initialize'}
		);
		await middle.deployed();
	});

	it('recover ERC20', async () => {
		const mintAmount = ethers.utils.parseUnits('604800', 18);
		const erc20Factory = await ethers.getContractFactory('CustomERC20');
		const mockErc20 = <CustomERC20>await erc20Factory.deploy(amount);
		await mockErc20.mint(middle.address, mintAmount);
		expect(await mockErc20.balanceOf(middle.address)).to.be.equal(mintAmount);
		const balance = await mockErc20.balanceOf(deployer.address);
		await middle.recoverERC20(mockErc20.address, mintAmount);
		expect(await mockErc20.balanceOf(deployer.address)).to.be.equal(balance.add(mintAmount));
	});
});
