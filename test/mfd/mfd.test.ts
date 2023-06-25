import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import hre, {ethers, upgrades} from 'hardhat';
import {advanceTimeAndBlock, getLatestBlockTimestamp} from '../../scripts/utils';
import {CustomERC20, LockerList, MultiFeeDistribution} from '../../typechain';
import HardhatDeployConfig from '../../config/31337';
import {setupTest} from '../setup';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
chai.use(solidity);
const {expect} = chai;

describe('MultiFeeDistribution', () => {
	let preTestSnapshotID: any;

	let deployer: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let treasury: SignerWithAddress;
	let mfd: MultiFeeDistribution;
	let radiant: CustomERC20;
	let lockerlist: LockerList;

	const QUART = 25000; //  25%
	const HALF = 65000; //  65%
	const WHOLE = 100000; // 100%
	const BURN = 20000; //  60%

	const MFD_REWARD_DURATION_SECS = parseInt(HardhatDeployConfig.MFD_REWARD_DURATION_SECS);
	const MFD_REWARD_LOOKBACK_SECS = parseInt(HardhatDeployConfig.MFD_REWARD_LOOKBACK_SECS);
	const MFD_LOCK_DURATION_SECS = parseInt(HardhatDeployConfig.MFD_LOCK_DURATION_SECS);
	const MFD_VEST_DURATION = HardhatDeployConfig.MFD_VEST_DURATION;

	const amount = ethers.utils.parseUnits('10000000', 18);

	beforeEach(async () => {
		preTestSnapshotID = await hre.network.provider.send('evm_snapshot');

		[deployer, user1, user2, treasury] = await ethers.getSigners();

		const config = HardhatDeployConfig;

		const erc20Factory = await ethers.getContractFactory('CustomERC20');
		radiant = <CustomERC20>await erc20Factory.deploy(amount);

		await radiant.transfer(user1.address, amount.div(10));
		await radiant.transfer(user2.address, amount.div(10));

		const UniV2TwapOracle = await ethers.getContractFactory('MockUniV2TwapOracle');
		const uniV2TwapOracle = await UniV2TwapOracle.deploy();
		await uniV2TwapOracle.deployed();

		const MockPoolHelper = await ethers.getContractFactory('MockPoolHelper');
		const poolHelper = await MockPoolHelper.deploy();
		const PriceProvider = await ethers.getContractFactory('PriceProvider');
		const priceProvider = await upgrades.deployProxy(
			PriceProvider,
			[config.CHAINLINK_ETH_USD_AGGREGATOR_PROXY, poolHelper.address],
			{initializer: 'initialize'}
		);
		await priceProvider.deployed();

		const LockerList = await ethers.getContractFactory('LockerList');
		lockerlist = await LockerList.deploy();
		await lockerlist.deployed();

		const mfdFactory = await ethers.getContractFactory('MultiFeeDistribution');
		mfd = <MultiFeeDistribution>await upgrades.deployProxy(
			mfdFactory,
			[
				radiant.address,
				deployer.address, // Mock address
				treasury.address,
				lockerlist.address,
				priceProvider.address,
				MFD_REWARD_DURATION_SECS,
				MFD_REWARD_LOOKBACK_SECS,
				MFD_LOCK_DURATION_SECS,
				BURN,
				MFD_VEST_DURATION,
			],
			{initializer: 'initialize'}
		);
		await mfd.deployed();
		await mfd.setLPToken(radiant.address);
		await lockerlist.transferOwnership(mfd.address);

		const mockChefFactory = await ethers.getContractFactory('MockIncentivesController');
		const mockChef = await mockChefFactory.deploy();
		await mockChef.deployed();

		const mockMiddleFactory = await ethers.getContractFactory('MockMiddleFeeDistribution');
		const mockMiddle = await mockMiddleFactory.deploy();
		await mockMiddle.deployed();

		await mfd.setMinters([deployer.address]);
		await mfd.setAddresses(mockChef.address, mockMiddle.address, deployer.address);
		await mfd.setLockTypeInfo(HardhatDeployConfig.LOCK_INFO.LOCK_PERIOD, HardhatDeployConfig.LOCK_INFO.MULTIPLIER);

		await radiant.connect(user1).approve(mfd.address, ethers.constants.MaxUint256);
		await radiant.connect(user2).approve(mfd.address, ethers.constants.MaxUint256);
	});

	afterEach(async () => {
		await hre.network.provider.send('evm_revert', [preTestSnapshotID]);
	});

	// it("getMFDstatsAddress", async () => {
	//   expect(await mfd.getMFDstatsAddress()).to.be.equal(
	//     ethers.constants.AddressZero
	//   );
	// });

	it('mintersArtSet', async () => {
		await expect(mfd.setMinters([deployer.address])).to.be.reverted;
	});

	it('setLPToken', async () => {
		await expect(mfd.setLPToken(deployer.address)).to.be.reverted;
	});

	it('setDefaultRelockTypeIndex', async () => {
		await expect(mfd.connect(user1).setDefaultRelockTypeIndex(4)).to.be.reverted;
		await mfd.connect(user1).setDefaultRelockTypeIndex(0);
	});

	it('setLockTypeInfo', async () => {
		await expect(
			mfd
				.connect(user1)
				.setLockTypeInfo(
					[
						MFD_LOCK_DURATION_SECS,
						MFD_LOCK_DURATION_SECS * 3,
						MFD_LOCK_DURATION_SECS * 6,
						MFD_LOCK_DURATION_SECS * 12,
					],
					[1, 2, 8, 20]
				)
		).to.be.revertedWith('Ownable: caller is not the owner');

		await expect(
			mfd.setLockTypeInfo(
				[MFD_LOCK_DURATION_SECS, MFD_LOCK_DURATION_SECS * 3, MFD_LOCK_DURATION_SECS * 6],
				[1, 2, 8, 20]
			)
		).to.be.reverted;

		await expect(mfd.connect(user1).stake(ethers.utils.parseUnits('1', 18), user1.address, 4)).to.be.reverted;
	});

	it('addReward', async () => {
		await expect(mfd.connect(user1).addReward(user1.address)).to.be.reverted;
		await expect(mfd.addReward(radiant.address)).to.be.reverted;
	});

	// it("delegateExit", async () => {
	//   await expect(mfd.delegateExit(user1.address)).to.be.not.reverted;
	// });

	it('Add some radiant rewards', async () => {
		const mintAmount = ethers.utils.parseUnits('604800', 18);
		await radiant.mint(mfd.address, mintAmount);
		await mfd.mint(mfd.address, 0, false);
		await mfd.mint(mfd.address, mintAmount, false);
		await radiant.mint(mfd.address, mintAmount);
		await mfd.mint(mfd.address, mintAmount, false);

		expect(await radiant.balanceOf(mfd.address)).to.be.equal(mintAmount.mul(2));
	});

	it('recover ERC20', async () => {
		const mintAmount = ethers.utils.parseUnits('604800', 18);
		await radiant.mint(mfd.address, mintAmount);

		const erc20Factory = await ethers.getContractFactory('CustomERC20');
		const mockErc20 = <CustomERC20>await erc20Factory.deploy(amount);
		await mockErc20.mint(mfd.address, mintAmount);
		expect(await mockErc20.balanceOf(mfd.address)).to.be.equal(mintAmount);
		const balance = await mockErc20.balanceOf(deployer.address);
		await mfd.recoverERC20(mockErc20.address, mintAmount);
		expect(await mockErc20.balanceOf(deployer.address)).to.be.equal(balance.add(mintAmount));
	});

	it('mint & stake vlidation', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await expect(mfd.connect(user1).mint(user1.address, depositAmount, true)).to.be.reverted;
		await mfd.mint(user1.address, 0, true);
		await mfd.mint(user1.address, depositAmount, false);
	});

	it('Withdraw expired locks', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount, true);

		const users = await lockerlist.getUsers(0, 1);
		expect(users[0]).to.be.equal(user1.address);

		const LOCK_DURATION = await mfd.defaultLockDuration();
		await advanceTimeAndBlock(LOCK_DURATION.toNumber());

		const balance0 = await radiant.balanceOf(user1.address);
		await mfd.connect(user1).setRelock(false);
		await mfd.connect(user1).withdrawExpiredLocksFor(user1.address);
		const balance1 = await radiant.balanceOf(user1.address);

		expect(balance1.sub(balance0)).to.be.equal(depositAmount);
	});

	it('Different lock periods', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await radiant.mint(mfd.address, depositAmount.mul(100));

		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await mfd.connect(user1).stake(depositAmount, user1.address, 1);
		await mfd.connect(user1).stake(depositAmount, user1.address, 2);
		await mfd.connect(user1).stake(depositAmount, user1.address, 3);

		await advanceTimeAndBlock(MFD_LOCK_DURATION_SECS / 3);
		expect((await mfd.lockedBalances(user1.address)).unlockable).to.be.equal(depositAmount);

		await advanceTimeAndBlock(MFD_LOCK_DURATION_SECS / 3);
		expect((await mfd.lockedBalances(user1.address)).unlockable).to.be.equal(depositAmount);

		await advanceTimeAndBlock(MFD_LOCK_DURATION_SECS / 3);
		expect((await mfd.lockedBalances(user1.address)).unlockable).to.be.equal(depositAmount.mul(2));

		await advanceTimeAndBlock(MFD_LOCK_DURATION_SECS / 3);
		expect((await mfd.lockedBalances(user1.address)).unlockable).to.be.equal(depositAmount.mul(2));

		await advanceTimeAndBlock(MFD_LOCK_DURATION_SECS / 3);
		expect((await mfd.lockedBalances(user1.address)).unlockable).to.be.equal(depositAmount.mul(2));

		await advanceTimeAndBlock(MFD_LOCK_DURATION_SECS / 3);
		expect((await mfd.lockedBalances(user1.address)).unlockable).to.be.equal(depositAmount.mul(3));

		await advanceTimeAndBlock(MFD_LOCK_DURATION_SECS * 2);
		expect((await mfd.lockedBalances(user1.address)).unlockable).to.be.equal(depositAmount.mul(4));
	});

	it('Different reward amount per lock lengths', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		const rewardAmount = ethers.utils.parseUnits('100', 18);

		await mfd.connect(user1).stake(depositAmount.mul(4), user1.address, 0);
		await mfd.connect(user2).stake(depositAmount, user2.address, 1);

		await radiant.mint(mfd.address, rewardAmount);
		await mfd.mint(mfd.address, rewardAmount, false);

		const REWARDS_DURATION = await mfd.rewardsDuration();
		await advanceTimeAndBlock(REWARDS_DURATION.toNumber());
		const rewards1 = await mfd.claimableRewards(user1.address);
		const rewards2 = await mfd.claimableRewards(user2.address);
		expect(rewards1[0].amount).to.be.equal(rewards2[0].amount);
	});

	it('relock expired locks', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount, true);

		const users = await lockerlist.getUsers(0, 1);
		expect(users[0]).to.be.equal(user1.address);

		const LOCK_DURATION = await mfd.defaultLockDuration();
		await advanceTimeAndBlock(LOCK_DURATION.toNumber());
		await mfd.connect(user1).relock();

		await advanceTimeAndBlock(LOCK_DURATION.toNumber());
		const balance0 = await radiant.balanceOf(user1.address);
		await mfd.connect(user1).setRelock(false);
		await mfd.connect(user1).withdrawExpiredLocksFor(user1.address);
		const balance1 = await radiant.balanceOf(user1.address);

		expect(balance1.sub(balance0)).to.be.equal(depositAmount);
	});

	it('autorelock', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount, true);
		await mfd.connect(user1).setRelock(true);

		const users = await lockerlist.getUsers(0, 1);
		expect(users[0]).to.be.equal(user1.address);

		const lockedBal1 = (await mfd.lockedBalances(user2.address)).locked;

		const LOCK_DURATION = await mfd.defaultLockDuration();
		await advanceTimeAndBlock(LOCK_DURATION.toNumber());
		await mfd.connect(user1).withdrawExpiredLocksFor(user1.address);

		const lockedBal2 = (await mfd.lockedBalances(user2.address)).locked;

		expect(lockedBal1).to.be.equal(lockedBal2);
	});

	it('the array is sorted when withdraw expired locks with smaller limit than lock length', async () => {
		await mfd.connect(user1).setRelock(false);

		const LOCK_DURATION = (await mfd.defaultLockDuration()).div(3);
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await radiant.mint(mfd.address, depositAmount.mul(10));

		await mfd.connect(user1).stake(depositAmount, user1.address, 0); // x1
		await mfd.connect(user1).stake(depositAmount, user1.address, 3); // x12
		await mfd.connect(user1).stake(depositAmount, user1.address, 0); // x3
		await mfd.connect(user1).stake(depositAmount, user1.address, 1); // x3
		await mfd.connect(user1).stake(depositAmount, user1.address, 2); // x6
		await mfd.connect(user1).stake(depositAmount, user1.address, 1); // x3
		await mfd.connect(user1).stake(depositAmount, user1.address, 1); // x3
		await mfd.connect(user1).stake(depositAmount, user1.address, 3); // x12
		await mfd.connect(user1).stake(depositAmount, user1.address, 2); // x6
		await mfd.connect(user1).stake(depositAmount, user1.address, 0); // x1

		// array is sorted
		const expectSorted = async () => {
			const lockInfo = await mfd.lockInfo(user1.address);
			for (let i = 1; i < lockInfo.length; i += 1) {
				expect(lockInfo[i].unlockTime).to.be.gt(lockInfo[i - 1].unlockTime);
			}
		};

		// x1 was locked 3 times
		await advanceTimeAndBlock(LOCK_DURATION.toNumber());
		await mfd.connect(user1).withdrawExpiredLocksFor(user1.address);

		await expectSorted();

		// x3 was locked 3 times
		await advanceTimeAndBlock(LOCK_DURATION.toNumber() * 3);
		await mfd.connect(user1).withdrawExpiredLocksForWithOptions(user1.address, 4, true);

		await expectSorted();

		// x6 was locked 2 times
		await advanceTimeAndBlock(LOCK_DURATION.toNumber() * 6);
		await mfd.connect(user1).withdrawExpiredLocksForWithOptions(user1.address, 4, true);

		await expectSorted();

		// x12 was locked 2 times
		await advanceTimeAndBlock(LOCK_DURATION.toNumber() * 12);
		await mfd.connect(user1).withdrawExpiredLocksForWithOptions(user1.address, 4, true);

		await expectSorted();

		// withdraw all left
		await mfd.connect(user1).withdrawExpiredLocksFor(user1.address);

		await expectSorted();
	});

	it('withdrawing works for various lock lengths', async () => {
		await mfd.connect(user1).setRelock(false);

		const LOCK_DURATION = (await mfd.defaultLockDuration()).div(3);
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await radiant.mint(mfd.address, depositAmount.mul(10));

		await mfd.connect(user1).stake(depositAmount, user1.address, 0); // x1
		await mfd.connect(user1).stake(depositAmount, user1.address, 3); // x12
		await mfd.connect(user1).stake(depositAmount, user1.address, 0); // x3
		await mfd.connect(user1).stake(depositAmount, user1.address, 1); // x3
		await mfd.connect(user1).stake(depositAmount, user1.address, 2); // x6
		await mfd.connect(user1).stake(depositAmount, user1.address, 1); // x3
		await mfd.connect(user1).stake(depositAmount, user1.address, 1); // x3
		await mfd.connect(user1).stake(depositAmount, user1.address, 3); // x12 // This gets aggregated
		await mfd.connect(user1).stake(depositAmount, user1.address, 2); // x6
		await mfd.connect(user1).stake(depositAmount, user1.address, 0); // x1

		// x1 was locked 3 times
		await advanceTimeAndBlock(LOCK_DURATION.toNumber());
		let balance0 = await radiant.balanceOf(user1.address);
		await mfd.connect(user1).withdrawExpiredLocksFor(user1.address);
		let balance1 = await radiant.balanceOf(user1.address);
		expect(balance1.sub(balance0)).to.be.equal(depositAmount.mul(3));

		let lockInfo = await mfd.lockedBalances(user1.address);
		expect(lockInfo.locked).to.be.equal(depositAmount.mul(7));
		expect(lockInfo.lockData.length).to.be.equal(6); // 6 because of the one aggregation

		// x3 was locked 3 times
		await advanceTimeAndBlock(LOCK_DURATION.toNumber() * 3);
		balance0 = await radiant.balanceOf(user1.address);
		await mfd.connect(user1).withdrawExpiredLocksFor(user1.address);
		balance1 = await radiant.balanceOf(user1.address);
		expect(balance1.sub(balance0)).to.be.equal(depositAmount.mul(3));

		lockInfo = await mfd.lockedBalances(user1.address);
		expect(lockInfo.locked).to.be.equal(depositAmount.mul(4));
		expect(lockInfo.lockData.length).to.be.equal(3);

		// x6 was locked 2 times
		await advanceTimeAndBlock(LOCK_DURATION.toNumber() * 6);
		balance0 = await radiant.balanceOf(user1.address);
		await mfd.connect(user1).withdrawExpiredLocksFor(user1.address);
		balance1 = await radiant.balanceOf(user1.address);
		expect(balance1.sub(balance0)).to.be.equal(depositAmount.mul(2));

		lockInfo = await mfd.lockedBalances(user1.address);
		expect(lockInfo.locked).to.be.equal(depositAmount.mul(2));
		expect(lockInfo.lockData.length).to.be.equal(1);

		// x12 was locked 1 time (due to aggregation)
		await advanceTimeAndBlock(LOCK_DURATION.toNumber() * 12);
		balance0 = await radiant.balanceOf(user1.address);
		await mfd.connect(user1).withdrawExpiredLocksFor(user1.address);
		balance1 = await radiant.balanceOf(user1.address);
		expect(balance1.sub(balance0)).to.be.equal(depositAmount.mul(2));

		lockInfo = await mfd.lockedBalances(user1.address);
		expect(lockInfo.locked).to.be.equal(0);
		expect(lockInfo.lockData.length).to.be.equal(0);
	});

	it('lock 50 times', async () => {
		await mfd.connect(user1).setRelock(false);

		const LOCK_DURATION = await mfd.defaultLockDuration();
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await radiant.mint(mfd.address, depositAmount.mul(10));

		let LockLength = 50
		let counter = LockLength+1;
		for (let i = 0; i < LockLength; i += 1) {
			// The max locks get aggregated (With the exception of the first one)
			counter -= (i % 4 == 3)? 1 : 0;
			await mfd.connect(user1).stake(depositAmount, user1.address, i % 4);
		}

		let lockInfo = await mfd.lockedBalances(user1.address);
		expect(lockInfo.locked).to.be.equal(depositAmount.mul(LockLength));
		expect(lockInfo.lockData.length).to.be.equal(counter);

		await advanceTimeAndBlock(LOCK_DURATION.toNumber() * 12);
		const balance0 = await radiant.balanceOf(user1.address);
		await mfd.connect(user1).withdrawExpiredLocksFor(user1.address);
		const balance1 = await radiant.balanceOf(user1.address);
		expect(balance1.sub(balance0)).to.be.equal(depositAmount.mul(50));

		lockInfo = await mfd.lockedBalances(user1.address);
		expect(lockInfo.locked).to.be.equal(0);
		expect(lockInfo.lockData.length).to.be.equal(0);
	});

	// it("Clean up expired locks and earnings", async () => {
	//   const depositAmount = ethers.utils.parseUnits("100", 18);
	//   await mfd.connect(user1).stake(depositAmount, user1.address, 0);
	//   await radiant.mint(mfd.address, depositAmount);
	//   await mfd.mint(user1.address, depositAmount, true);

	//   const LOCK_DURATION = await mfd.DEFAULT_LOCK_DURATION();
	//   await advanceTimeAndBlock(LOCK_DURATION.toNumber());

	//   const balance0 = await radiant.balanceOf(user1.address);
	//   await mfd.cleanExpiredLocksAndEarnings([user1.address, user2.address]);
	//   const balance1 = await radiant.balanceOf(user1.address);

	//   expect(balance1.sub(balance0)).to.be.equal(depositAmount.mul(2));
	// });

	it('exit; validation', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount, true);

		await advanceTimeAndBlock(MFD_VEST_DURATION);

		const balance10 = await radiant.balanceOf(user1.address);
		await mfd.connect(user1).exit(true);
		const balance11 = await radiant.balanceOf(user1.address);

		expect(balance11.sub(balance10)).to.be.equal(depositAmount);
	});

	it('exit; with penalty', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount.div(5), true);
		await mfd.mint(user1.address, depositAmount.div(5), true);
		await mfd.mint(user1.address, depositAmount.div(5), true);
		await mfd.mint(user1.address, depositAmount.div(5), true);
		await mfd.mint(user1.address, depositAmount.div(5), true);

		await mfd.connect(user1).exit(false);
	});

	it('Remove exit penalties; exit; withdraw full earnings', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount, true);

		await advanceTimeAndBlock(MFD_VEST_DURATION);

		const balance10 = await radiant.balanceOf(user1.address);
		await mfd.connect(user1).exit(true);
		const balance11 = await radiant.balanceOf(user1.address);

		expect(balance11.sub(balance10)).to.be.equal(depositAmount);
	});

	it('withdraw; empty earnings', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		const LOCK_DURATION = (await mfd.defaultLockDuration()).toNumber();

		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await radiant.mint(mfd.address, depositAmount.mul(4));

		await mfd.mint(user1.address, depositAmount, true);
		await advanceTimeAndBlock(LOCK_DURATION / 3);
		await mfd.mint(user1.address, depositAmount, true);
		await advanceTimeAndBlock(LOCK_DURATION / 3);
		await mfd.mint(user1.address, depositAmount, true);
		await advanceTimeAndBlock(LOCK_DURATION / 3);
		await mfd.mint(user1.address, depositAmount, true);

		await advanceTimeAndBlock(LOCK_DURATION / 3);
		await mfd.connect(user1).withdraw(depositAmount);

		await advanceTimeAndBlock(LOCK_DURATION / 3);
		await mfd.connect(user1).withdraw(depositAmount);

		await advanceTimeAndBlock(LOCK_DURATION / 3);
		await mfd.connect(user1).withdraw(depositAmount);
	});

	it('Remove exit penalties; withdraw from unlocked', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount, false);

		const LOCK_DURATION = await mfd.defaultLockDuration();
		await advanceTimeAndBlock(LOCK_DURATION.toNumber());

		const balance10 = await radiant.balanceOf(user1.address);
		await expect(mfd.connect(user1).withdraw(0)).to.be.reverted;
		await mfd.connect(user1).withdraw(depositAmount);
		const balance11 = await radiant.balanceOf(user1.address);

		expect(balance11.sub(balance10)).to.be.equal(depositAmount);
	});

	it('Remove exit penalties; Insufficient unlocked balance', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount, true);

		const LOCK_DURATION = await mfd.defaultLockDuration();
		await advanceTimeAndBlock(LOCK_DURATION.toNumber());
		await expect(mfd.connect(user1).withdraw(depositAmount.mul(2))).to.be.reverted;
		await mfd.connect(user1).withdraw(depositAmount);
	});

	it('Remove exit penalties; Insufficient balance', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount, true);

		await expect(mfd.connect(user1).withdraw(depositAmount)).to.be.reverted;

		const LOCK_DURATION = await mfd.defaultLockDuration();
		await advanceTimeAndBlock(LOCK_DURATION.toNumber());
		await mfd.connect(user1).withdraw(depositAmount);
	});

	it('Remove exit penalties; with penalty', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount.div(5), true);
		await mfd.mint(user1.address, depositAmount.div(5), true);
		await mfd.mint(user1.address, depositAmount.div(5), true);
		await mfd.mint(user1.address, depositAmount.div(5), true);
		await mfd.mint(user1.address, depositAmount.div(5), true);

		const withdrawAmount = depositAmount.div(10);
		const balance10 = await radiant.balanceOf(user1.address);
		await mfd.connect(user1).withdraw(withdrawAmount);
		const balance11 = await radiant.balanceOf(user1.address);

		expect(balance11.sub(balance10)).to.be.equal(withdrawAmount);
	});

	it('Remove exit penalties; withdraw', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount, true);

		const LOCK_DURATION = await mfd.defaultLockDuration();
		await advanceTimeAndBlock(LOCK_DURATION.toNumber());

		const balance10 = await radiant.balanceOf(user1.address);
		await mfd.connect(user1).withdraw(depositAmount);
		const balance11 = await radiant.balanceOf(user1.address);

		expect(balance11.sub(balance10)).to.be.equal(depositAmount);
	});

	it('Vesting RDNT stop receiving rewards', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		const rewardAmount = ethers.utils.parseUnits('100', 18);
		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user2.address, depositAmount, true);

		await radiant.mint(mfd.address, rewardAmount);
		await mfd.mint(mfd.address, rewardAmount, false);

		const REWARDS_DURATION = await mfd.rewardsDuration();
		await advanceTimeAndBlock(REWARDS_DURATION.toNumber());
		const rewards1 = await mfd.claimableRewards(user1.address);
		const rewards2 = await mfd.claimableRewards(user2.address);
		expect(rewards1[0].amount).to.be.gt(rewardAmount.div(10)); // Round issue
		expect(rewards2[0].amount).to.be.equal(0);
	});

	it('Linear exit; day 1', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount, true);

		const userBal0 = await radiant.balanceOf(user1.address);
		const daoBal0 = await radiant.balanceOf(treasury.address);

		const withdrawable0 = await mfd.withdrawableBalance(user1.address);
		const blockTimestamp = await getLatestBlockTimestamp();
		const unlockTime = blockTimestamp + MFD_VEST_DURATION;
		const earningsData = await mfd.earnedBalances(user1.address);
		expect(earningsData.earningsData[0].unlockTime).to.be.equal(unlockTime);

		const penaltyFactor = Math.floor(QUART + (HALF * (unlockTime - blockTimestamp)) / MFD_VEST_DURATION);
		const penalty = depositAmount.mul(penaltyFactor).div(WHOLE);
		const amount = depositAmount.sub(penalty);
		const burnAmount = penalty.mul(BURN).div(WHOLE);

		expect(withdrawable0.amount).to.be.equal(amount);
		expect(withdrawable0.penaltyAmount).to.be.equal(penalty);
		expect(withdrawable0.burnAmount).to.be.equal(burnAmount);

		await mfd.connect(user1).exit(true);
		const userBal1 = await radiant.balanceOf(user1.address);
		const daoBal1 = await radiant.balanceOf(treasury.address);
		expect(userBal1.sub(userBal0)).to.be.gt(amount);
		expect(daoBal1.sub(daoBal0)).to.be.lt(penalty.sub(burnAmount));
	});

	it('Linear exit; day 30', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount, true);

		let blockTimestamp = await getLatestBlockTimestamp();
		const unlockTime = blockTimestamp + MFD_VEST_DURATION;

		const userBal0 = await radiant.balanceOf(user1.address);
		const daoBal0 = await radiant.balanceOf(treasury.address);

		await advanceTimeAndBlock(MFD_VEST_DURATION / 3);

		blockTimestamp = await getLatestBlockTimestamp();
		const withdrawable0 = await mfd.withdrawableBalance(user1.address);
		const earningsData = await mfd.earnedBalances(user1.address);
		expect(earningsData.earningsData[0].unlockTime).to.be.equal(unlockTime);

		const penaltyFactor = Math.floor(QUART + (HALF * (unlockTime - blockTimestamp)) / MFD_VEST_DURATION);
		const penalty = depositAmount.mul(penaltyFactor).div(WHOLE);
		const amount = depositAmount.sub(penalty);
		const burnAmount = penalty.mul(BURN).div(WHOLE);

		expect(withdrawable0.amount).to.be.equal(amount);
		expect(withdrawable0.penaltyAmount).to.be.equal(penalty);
		expect(withdrawable0.burnAmount).to.be.equal(burnAmount);

		await mfd.connect(user1).exit(true);
		const userBal1 = await radiant.balanceOf(user1.address);

		const daoBal1 = await radiant.balanceOf(treasury.address);
		expect(userBal1.sub(userBal0)).equals(amount);
		expect(daoBal1.sub(daoBal0)).equals(penalty.sub(burnAmount));
	});

	it('Linear exit; last day', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount, true);

		const userBal0 = await radiant.balanceOf(user1.address);
		const daoBal0 = await radiant.balanceOf(treasury.address);

		await advanceTimeAndBlock(MFD_VEST_DURATION);

		const withdrawable0 = await mfd.withdrawableBalance(user1.address);
		expect(withdrawable0.amount).to.be.equal(depositAmount);
		expect(withdrawable0.penaltyAmount).to.be.equal(0);
		expect(withdrawable0.burnAmount).to.be.equal(0);

		await mfd.connect(user1).exit(true);
		const userBal1 = await radiant.balanceOf(user1.address);
		const daoBal1 = await radiant.balanceOf(treasury.address);
		expect(userBal1.sub(userBal0)).to.be.equal(depositAmount);
		expect(daoBal1.sub(daoBal0)).to.be.equal(0);
	});

	it('Linear exit; withdraw; day 1', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount, true);

		const userBal0 = await radiant.balanceOf(user1.address);
		const daoBal0 = await radiant.balanceOf(treasury.address);

		const blockTimestamp = await getLatestBlockTimestamp();
		const unlockTime = blockTimestamp + MFD_VEST_DURATION;
		const earningsData = await mfd.earnedBalances(user1.address);
		expect(earningsData.earningsData[0].unlockTime).to.be.equal(unlockTime);

		const penaltyFactor = Math.floor(QUART + (HALF * (unlockTime - blockTimestamp)) / MFD_VEST_DURATION);
		const penalty = depositAmount.mul(penaltyFactor).div(WHOLE);
		const amount = depositAmount.sub(penalty);

		const requiredAmount = amount.mul(WHOLE).div(WHOLE - penaltyFactor);
		const acutalPenalty = requiredAmount.mul(penaltyFactor).div(WHOLE);
		const burnAmount = acutalPenalty.mul(BURN).div(WHOLE);

		await mfd.connect(user1).withdraw(amount);
		const userBal1 = await radiant.balanceOf(user1.address);
		const daoBal1 = await radiant.balanceOf(treasury.address);
		expect(userBal1.sub(userBal0)).to.be.equal(amount);
		expect(daoBal1.sub(daoBal0)).to.be.lt(penalty.sub(burnAmount));
	});

	it('Linear exit; day 30', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount, true);

		const blockTimestamp = await getLatestBlockTimestamp();

		const userBal0 = await radiant.balanceOf(user1.address);
		const daoBal0 = await radiant.balanceOf(treasury.address);

		await advanceTimeAndBlock(MFD_VEST_DURATION / 3);

		const earningsData = await mfd.earnedBalances(user1.address);
		const unlockTime = blockTimestamp + MFD_VEST_DURATION;
		expect(earningsData.earningsData[0].unlockTime).to.be.equal(unlockTime);

		const penaltyFactor = Math.floor(QUART + (HALF * (unlockTime - blockTimestamp)) / MFD_VEST_DURATION);
		const penalty = depositAmount.mul(penaltyFactor).div(WHOLE);
		const amount = depositAmount.sub(penalty);
		const burnAmount = penalty.mul(BURN).div(WHOLE);

		await mfd.connect(user1).withdraw(amount);
		const userBal1 = await radiant.balanceOf(user1.address);
		const daoBal1 = await radiant.balanceOf(treasury.address);
		expect(userBal1.sub(userBal0)).to.be.equal(amount);
		expect(daoBal1.sub(daoBal0)).to.be.lt(penalty.sub(burnAmount));
	});

	it('Linear exit; last day', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount, true);

		const userBal0 = await radiant.balanceOf(user1.address);
		const daoBal0 = await radiant.balanceOf(treasury.address);

		await advanceTimeAndBlock(MFD_VEST_DURATION);

		await mfd.connect(user1).withdraw(depositAmount);
		const userBal1 = await radiant.balanceOf(user1.address);
		const daoBal1 = await radiant.balanceOf(treasury.address);
		expect(userBal1.sub(userBal0)).to.be.equal(depositAmount);
		expect(daoBal1.sub(daoBal0)).to.be.equal(0);
	});

	it('Individual early exit; validation', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount, true);
		const timestamp = await getLatestBlockTimestamp();
		await expect(mfd.connect(user1).individualEarlyExit(true, timestamp - 1)).to.be.reverted;
	});

	it('Individual early exit; with penalty', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount.div(5), true);
		await mfd.mint(user1.address, depositAmount.div(5), true);
		await mfd.mint(user1.address, depositAmount.div(5), true);
		await mfd.mint(user1.address, depositAmount.div(5), true);
		await mfd.mint(user1.address, depositAmount.div(5), true);

		const timestamp = await getLatestBlockTimestamp();
		await mfd.connect(user1).individualEarlyExit(true, timestamp + MFD_VEST_DURATION);

		await advanceTimeAndBlock(MFD_VEST_DURATION);
		const withdrawable = await mfd.withdrawableBalance(user1.address);
		expect(withdrawable.amount).to.be.equal(depositAmount.div(5).mul(4));
	});

	it('Individual early exit; zero amount', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		const LOCK_DURATION = (await mfd.defaultLockDuration()).toNumber();
		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount.div(5), true);

		const timestamp = await getLatestBlockTimestamp();
		await mfd.connect(user1).individualEarlyExit(true, timestamp + 10);
	});

	it('cleanExpiredLocksAndEarnings; it should work fine', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		const LOCK_DURATION = await mfd.defaultLockDuration();

		await radiant.mint(mfd.address, depositAmount);

		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await mfd.mint(user1.address, depositAmount.div(5), true);

		await advanceTimeAndBlock(LOCK_DURATION.toNumber() / 3);
		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await mfd.mint(user1.address, depositAmount.div(5), true);

		await advanceTimeAndBlock(LOCK_DURATION.toNumber() / 3);
		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await mfd.mint(user1.address, depositAmount.div(5), true);

		await advanceTimeAndBlock(LOCK_DURATION.toNumber() / 3);
		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await mfd.mint(user1.address, depositAmount.div(5), true);

		await advanceTimeAndBlock(LOCK_DURATION.toNumber() / 3);
		await mfd.connect(user1).stake(depositAmount, user1.address, 0);
		await mfd.mint(user1.address, depositAmount.div(5), true);

		await advanceTimeAndBlock(LOCK_DURATION.toNumber() / 3);

		// const balance10 = await radiant.balanceOf(user1.address);
		// await mfd.connect(user1).cleanExpiredLocksAndEarnings([user1.address]);
		// const balance11 = await radiant.balanceOf(user1.address);
		// expect(balance11.sub(balance10)).to.be.gt(depositAmount);
	});

	it('earnedBalances', async () => {
		const withdrawableBalance = await mfd.withdrawableBalance(user1.address);
		expect(withdrawableBalance.amount).to.be.equal(0);
		expect(withdrawableBalance.penaltyAmount).to.be.equal(0);
		expect(withdrawableBalance.burnAmount).to.be.equal(0);

		const depositAmount = ethers.utils.parseUnits('100', 18);
		await radiant.mint(mfd.address, depositAmount);
		await mfd.mint(user1.address, depositAmount, true);

		expect(await mfd.getRewardForDuration(radiant.address)).to.be.equal(0);

		await advanceTimeAndBlock(MFD_VEST_DURATION);
		const earningsData = await mfd.earnedBalances(user1.address);
		expect(earningsData.unlocked).to.be.equal(depositAmount);
	});

	it('getReward; unknown token', async () => {
		await expect(mfd.connect(user1).getReward([user1.address])).to.be.reverted;
	});

	it('getReward; notify after notify', async () => {
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await mfd.connect(user1).stake(depositAmount, user1.address, 0);

		const erc20Factory = await ethers.getContractFactory('CustomERC20');
		const mockErc20 = <CustomERC20>await erc20Factory.deploy(amount);
		await mfd.addReward(mockErc20.address);

		await mockErc20.mint(mfd.address, depositAmount);
		await mfd.connect(user1).getReward([mockErc20.address]);

		const LOOPBACK = (await mfd.rewardsLookback()).toNumber();
		await advanceTimeAndBlock(LOOPBACK * 2);

		await mockErc20.mint(mfd.address, depositAmount);
		await mfd.connect(user1).getReward([mockErc20.address]);

		await mockErc20.mint(mfd.address, depositAmount);
		await mfd.connect(user1).getReward([mockErc20.address]);

		await advanceTimeAndBlock(LOOPBACK);

		await mockErc20.mint(mfd.address, depositAmount);
		await mfd.connect(user1).getReward([mockErc20.address]);

		await advanceTimeAndBlock(LOOPBACK / 2);

		await mockErc20.mint(mfd.address, depositAmount);
		await mfd.connect(user1).getReward([mockErc20.address]);
	});

	it('different staking token and rdntToken', async () => {
		const config = HardhatDeployConfig;

		const UniV2TwapOracle = await ethers.getContractFactory('MockUniV2TwapOracle');
		const uniV2TwapOracle = await UniV2TwapOracle.deploy();
		await uniV2TwapOracle.deployed();

		const MockPoolHelper = await ethers.getContractFactory('MockPoolHelper');
		const poolHelper = await MockPoolHelper.deploy();
		const PriceProvider = await ethers.getContractFactory('PriceProvider');
		const priceProvider = await upgrades.deployProxy(
			PriceProvider,
			[config.CHAINLINK_ETH_USD_AGGREGATOR_PROXY, poolHelper.address],
			{initializer: 'initialize'}
		);
		await priceProvider.deployed();

		const mfdFactory = await ethers.getContractFactory('MultiFeeDistribution');
		const mfd = await upgrades.deployProxy(
			mfdFactory,
			[
				radiant.address,
				deployer.address, // Mock address
				treasury.address,
				lockerlist.address,
				priceProvider.address,
				MFD_REWARD_DURATION_SECS,
				MFD_REWARD_LOOKBACK_SECS,
				MFD_LOCK_DURATION_SECS,
				BURN,
				MFD_VEST_DURATION,
			],
			{initializer: 'initialize'}
		);
		await mfd.deployed();

		const mockChefFactory = await ethers.getContractFactory('MockIncentivesController');
		const mockChef = await mockChefFactory.deploy();
		await mockChef.deployed();

		const mockMiddleFactory = await ethers.getContractFactory('MockMiddleFeeDistribution');
		const mockMiddle = await mockMiddleFactory.deploy();
		await mockMiddle.deployed();

		await mfd.setMinters([deployer.address]);
		await mfd.setAddresses(mockChef.address, mockMiddle.address, deployer.address);

		expect(await mfd.totalBalance(user1.address)).to.be.equal(0);
	});

	it("Funds shouldn't be withdrawn by other person to staker", async () => {
		const LOCK_DURATION = (await mfd.defaultLockDuration()).div(3);
		const depositAmount = ethers.utils.parseUnits('100', 18);
		await radiant.mint(mfd.address, depositAmount.mul(10));

		await mfd.connect(user1).stake(depositAmount, user1.address, 0); // x1
		await mfd.connect(user1).stake(depositAmount, user1.address, 3); // x12
		await mfd.connect(user1).stake(depositAmount, user1.address, 0); // x3
		await mfd.connect(user1).stake(depositAmount, user1.address, 1); // x3
		await mfd.connect(user1).stake(depositAmount, user1.address, 2); // x6
		await mfd.connect(user1).stake(depositAmount, user1.address, 1); // x3
		await mfd.connect(user1).stake(depositAmount, user1.address, 1); // x3
		await mfd.connect(user1).stake(depositAmount, user1.address, 3); // x12
		await mfd.connect(user1).stake(depositAmount, user1.address, 2); // x6
		await mfd.connect(user1).stake(depositAmount, user1.address, 0); // x1

		const victim = user1.address;
		// attack part
		const totalBalanceBefore = await mfd.totalBalance(victim);
		const lockInfoBefore = await mfd.lockInfo(victim);
		const autoRelockDisabled = await mfd.autoRelockDisabled(victim);

		expect(autoRelockDisabled).equal(false); // the victim prefers to re-lock their funds

		await advanceTimeAndBlock(LOCK_DURATION.toNumber() * 3);

		await expect(mfd.connect(user2).withdrawExpiredLocksForWithOptions(victim, 1, true)).to.be.reverted; // only withdrawing one lock because it's just a POC
		await mfd.connect(user1).withdrawExpiredLocksForWithOptions(victim, 1, true); // only withdrawing one lock because it's just a POC

		const totalBalanceAfter = await mfd.totalBalance(victim);
		const lockInfoAfter = await mfd.lockInfo(victim);

		expect(totalBalanceAfter).to.be.lte(totalBalanceBefore); // we successfully forces a user to withdraw even though he preferred to re-lock
		expect(lockInfoAfter.length).to.be.lte(lockInfoBefore.length); // There are less locks after the withdrawal as expected
	});
});
