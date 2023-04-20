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

	describe("addReward", async () => {
		it('owner or admin permission', async () => {
			await expect(middle.connect(user1).addReward(deployer.address)).to.be.revertedWith("caller is not the admin or owner");
			await middle.setAdmin(user1.address);
			await middle.connect(user1).addReward(deployer.address);
			await middle.addReward(user1.address);
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
			{initializer: 'initialize', unsafeAllow: ['constructor']}
		);
		await middle.deployed();
	});


	it('init params validation', async () => {
		const middleFactory = await ethers.getContractFactory('MiddleFeeDistribution');
		await expect(
			middle.initialize(radiant.address, mfd.address, mfd.address)
		).to.be.revertedWith('Contract instance has already been initialized');
		await expect(
			upgrades.deployProxy(
				middleFactory,
				[ethers.constants.AddressZero, mfd.address, mfd.address], //middle should be aaveoracle
				{initializer: 'initialize'}
			)
		).to.be.reverted;
		await expect(
			upgrades.deployProxy(
				middleFactory,
				[radiant.address, ethers.constants.AddressZero, mfd.address], //middle should be aaveoracle
				{initializer: 'initialize'}
			)
		).to.be.reverted;
	});

	describe("setOperationExpenses", async () => {
		it('owner permission', async () => {
			await expect(middle.connect(user1).setOperationExpenses(deployer.address, 100)).to.be.revertedWith("Ownable: caller is not the owner");
		});

		it('params validation', async () => {
			await expect(middle.setOperationExpenses(deployer.address, 10001)).to.be.reverted;
			await expect(middle.setOperationExpenses(ethers.constants.AddressZero, 1000)).to.be.reverted;
		});
	});

	describe("setAdmin", async () => {
		it('owner permission', async () => {
			await expect(middle.connect(user1).setAdmin(deployer.address)).to.be.revertedWith("Ownable: caller is not the owner");
		});

		it('params validation', async () => {
			await expect(middle.setAdmin(ethers.constants.AddressZero)).to.be.reverted;
		});
	});

	describe("forwardReward", async () => {
		it('permission', async () => {
			await expect(middle.connect(user1).forwardReward([deployer.address])).to.be.reverted;
		});

		it('zero expense', async () => {
			await middle.connect(mfd).forwardReward([radiant.address]);
		});

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

		await expect(middle.connect(user1).recoverERC20(mockErc20.address, mintAmount)).to.be.revertedWith("Ownable: caller is not the owner");
	});
});
