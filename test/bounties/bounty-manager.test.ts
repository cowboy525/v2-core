import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {ethers, upgrades} from 'hardhat';
import {advanceTimeAndBlock} from '../../scripts/utils';
import {
	BountyManager,
	LendingPool,
	MultiFeeDistribution,
	ERC20,
	VariableDebtToken,
	Leverager,
	WETH,
	WETHGateway,
	PriceProvider,
	EligibilityDataProvider,
} from '../../typechain';
import _ from 'lodash';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
import {DeployData} from '../../scripts/deploy/types';
import {loadFixture} from '@nomicfoundation/hardhat-network-helpers';
import {BigNumber} from 'ethers';
import {deposit, doBorrow, toNum, zap} from './helpers';
import {setupTest} from '../setup';

chai.use(solidity);
const {expect} = chai;

let multiFeeDistribution: MultiFeeDistribution;
let eligibilityProvider: EligibilityDataProvider;
let lendingPool: LendingPool;
let priceProvider: PriceProvider;
let leverager: Leverager;
let wethGateway: WETHGateway;
let weth: WETH;
let deployData: DeployData;
let user1: SignerWithAddress;
let user2: SignerWithAddress;
let hunter: SignerWithAddress;
let vdWETH: VariableDebtToken;
let deployer: SignerWithAddress;
let DEFAULT_LOCK_TIME: number;
let LOCK_DURATION: number;
let SKIP_DURATION: number;
let bountyManager: BountyManager;
let lpToken: ERC20;

const eligibleAmt = 1000000;
const acceptableUserSlippage = 9500;

const generatePlatformRevenue = async (duration: number = SKIP_DURATION) => {
	await doBorrow('rWETH', '1000', deployer, lendingPool, deployData);
	await doBorrow('rUSDC', '10000', deployer, lendingPool, deployData);
	await deposit('rUSDT', '10000', deployer, lendingPool, deployData);
	await doBorrow('rUSDT', '5000', deployer, lendingPool, deployData);
	await deposit('rWBTC', '20', deployer, lendingPool, deployData);
	await doBorrow('rWBTC', '10', deployer, lendingPool, deployData);
	await advanceTimeAndBlock(duration);
	await doBorrow('rWETH', '1000', deployer, lendingPool, deployData);
	await doBorrow('rUSDC', '1000', deployer, lendingPool, deployData);
	await doBorrow('rUSDT', '50', deployer, lendingPool, deployData);
	await doBorrow('rWBTC', '.1', deployer, lendingPool, deployData);

	await multiFeeDistribution.connect(deployer).getAllRewards();
	await advanceTimeAndBlock(duration);
};

const zapAndDeposit = async (defaultLockTime: number, depositAmt: number) => {
	// await multiFeeDistribution.connect(user1).setRelock(relock);
	await multiFeeDistribution.connect(user1).setDefaultRelockTypeIndex(defaultLockTime);
	await deposit('rUSDC', depositAmt.toString(), user1, lendingPool, deployData);
	await zap(user1, deployData, true, defaultLockTime);

	// Now Locked
	const isEligible = await eligibilityProvider.isEligibleForRewards(user1.address);
	const lockedUsd = await eligibilityProvider.lockedUsdValue(user1.address);
	const requiredUsdValue = await eligibilityProvider.requiredUsdValue(user1.address);
	return {
		isEligible,
		lockedUsd,
		requiredUsdValue,
	};
};

const loadZappedUserFixture = async () => {
	({
		multiFeeDistribution,
		eligibilityProvider,
		multiFeeDistribution,
		lendingPool,
		priceProvider,
		leverager,
		weth,
		wethGateway,
		deployData,
		LOCK_DURATION,
		bountyManager,
		user1,
		user2,
		deployer,
	} = await setupTest());
	hunter = user2;
	DEFAULT_LOCK_TIME = LOCK_DURATION;
	SKIP_DURATION = DEFAULT_LOCK_TIME / 20;
	lpToken = await ethers.getContractAt('ERC20', deployData.stakingToken);
	// Deposit assets
	await deposit('rWETH', '10000', deployer, lendingPool, deployData);

	await zapAndDeposit(0, eligibleAmt);
};

describe(`BountyManager:`, async () => {
	let pendingWeth: BigNumber;

	before(async () => {
		await loadZappedUserFixture();
		await multiFeeDistribution.connect(user1).setAutocompound(true, acceptableUserSlippage);
		const minDLPBalance = await bountyManager.minDLPBalance();
		await lpToken.approve(multiFeeDistribution.address, minDLPBalance);
		await multiFeeDistribution.stake(minDLPBalance, hunter.address, 0);

		let vdWETHAddress = await leverager.getVDebtToken(weth.address);
		vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', vdWETHAddress);

		await vdWETH.connect(hunter).approveDelegation(leverager.address, ethers.constants.MaxUint256);

		await wethGateway.connect(hunter).depositETHWithAutoDLP(lendingPool.address, hunter.address, 0, 0, {
			value: ethers.utils.parseEther('1'),
		});
	});

	it('init params validation', async () => {
		const BountyManagerFactory = await ethers.getContractFactory('BountyManager');
		await expect(
			bountyManager.initialize(
				user1.address,
				user1.address,
				user1.address,
				user1.address,
				user1.address,
				user1.address,
				user1.address,
				1000,
				1000,
				1000,
				1000
			)
		).to.be.revertedWith('Contract instance has already been initialized');
		await expect(
			upgrades.deployProxy(
				BountyManagerFactory,
				[
					ethers.constants.AddressZero,
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					1000,
					1000,
					1000,
					1000
				],
				{initializer: 'initialize'}
			)
		).to.be.revertedWith("AddressZero");
		await expect(
			upgrades.deployProxy(
				BountyManagerFactory,
				[
					user1.address,
					ethers.constants.AddressZero,
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					1000,
					1000,
					1000,
					1000
				],
				{initializer: 'initialize'}
			)
		).to.be.revertedWith("AddressZero");
		await expect(
			upgrades.deployProxy(
				BountyManagerFactory,
				[
					user1.address,
					user1.address,
					ethers.constants.AddressZero,
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					1000,
					1000,
					1000,
					1000
				],
				{initializer: 'initialize'}
			)
		).to.be.revertedWith("AddressZero");
		await expect(
			upgrades.deployProxy(
				BountyManagerFactory,
				[
					user1.address,
					user1.address,
					user1.address,
					ethers.constants.AddressZero,
					user1.address,
					user1.address,
					user1.address,
					1000,
					1000,
					1000,
					1000
				],
				{initializer: 'initialize'}
			)
		).to.be.revertedWith("AddressZero");
		await expect(
			upgrades.deployProxy(
				BountyManagerFactory,
				[
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					ethers.constants.AddressZero,
					user1.address,
					user1.address,
					1000,
					1000,
					1000,
					1000
				],
				{initializer: 'initialize'}
			)
		).to.be.revertedWith("AddressZero");
		await expect(
			upgrades.deployProxy(
				BountyManagerFactory,
				[
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					ethers.constants.AddressZero,
					user1.address,
					1000,
					1000,
					1000,
					1000
				],
				{initializer: 'initialize'}
			)
		).to.be.revertedWith("AddressZero");
		await expect(
			upgrades.deployProxy(
				BountyManagerFactory,
				[
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					ethers.constants.AddressZero,
					1000,
					1000,
					1000,
					1000
				],
				{initializer: 'initialize'}
			)
		).to.be.revertedWith("AddressZero");
		await expect(
			upgrades.deployProxy(
				BountyManagerFactory,
				[
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					10001,
					1000,
					1000,
					1000
				],
				{initializer: 'initialize'}
			)
		).to.be.revertedWith("InvalidNumber");
		await expect(
			upgrades.deployProxy(
				BountyManagerFactory,
				[
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					1000,
					0,
					1000,
					1000
				],
				{initializer: 'initialize'}
			)
		).to.be.revertedWith("InvalidNumber");
		await expect(
			upgrades.deployProxy(
				BountyManagerFactory,
				[
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					user1.address,
					1000,
					1000,
					0,
					1000
				],
				{initializer: 'initialize'}
			)
		).to.be.revertedWith("InvalidNumber");
	});

	describe("pause/unpause", async () => {
		it('owner permission', async () => {
			await expect(bountyManager.connect(user1).pause()).to.be.revertedWith("Ownable: caller is not the owner");
			await expect(bountyManager.connect(user1).unpause()).to.be.revertedWith("Ownable: caller is not the owner");
			await bountyManager.pause();
			await bountyManager.unpause();
		});

		it("functions when not paused", async () => {
			await bountyManager.pause();
			await expect(bountyManager.connect(user1).quote(user1.address)).to.be.revertedWith("Pausable: paused");
			await expect(bountyManager.connect(user1).claim(user1.address, 0)).to.be.revertedWith("Pausable: paused");
			await expect(bountyManager.connect(user1).executeBounty(user1.address, false, 0)).to.be.revertedWith("Pausable: paused");
			await expect(bountyManager.connect(user1).getBaseBounty()).to.be.revertedWith("Pausable: paused");
			await bountyManager.unpause();
		});
	});

	it('setMinStakeAmount', async function () {
		await expect(bountyManager.connect(user2).setMinStakeAmount(1000)).to.be.revertedWith(
			'Ownable: caller is not the owner'
		);
	});

	it('setBaseBountyUsdTarget', async function () {
		await expect(bountyManager.connect(user2).setBaseBountyUsdTarget(1000)).to.be.revertedWith(
			'Ownable: caller is not the owner'
		);
		await bountyManager.setBaseBountyUsdTarget(await bountyManager.baseBountyUsdTarget());
	});

	it('setHunterShare', async function () {
		await expect(bountyManager.connect(user2).setHunterShare(1000)).to.be.revertedWith(
			'Ownable: caller is not the owner'
		);
		await expect(bountyManager.setHunterShare(10001)).to.be.revertedWith(
			'Override'
		);
		await bountyManager.setHunterShare(await bountyManager.hunterShare());
	});

	it('setMaxBaseBounty', async function () {
		await expect(bountyManager.connect(user2).setMaxBaseBounty(1000)).to.be.revertedWith(
			'Ownable: caller is not the owner'
		);
		await bountyManager.setMaxBaseBounty(await bountyManager.maxBaseBounty());
	});

	it('setBountyBooster', async function () {
		await expect(bountyManager.connect(user2).setBountyBooster(1000)).to.be.revertedWith(
			'Ownable: caller is not the owner'
		);
		await bountyManager.setBountyBooster(await bountyManager.bountyBooster());
	});

	it('setSlippageLimit', async function () {
		await expect(bountyManager.connect(user2).setSlippageLimit(1000)).to.be.revertedWith(
			'Ownable: caller is not the owner'
		);
		await expect(bountyManager.setSlippageLimit(10001)).to.be.revertedWith(
			'InvalidSlippage'
		);
	});

	it('setBounties', async function () {
		await expect(bountyManager.connect(user2).setBounties()).to.be.revertedWith(
			'Ownable: caller is not the owner'
		);
	});

	it('addAddressToWL', async function () {
		await expect(bountyManager.connect(user2).addAddressToWL(user2.address, true)).to.be.revertedWith(
			'Ownable: caller is not the owner'
		);
	});

	it('changeWL', async function () {
		await expect(bountyManager.connect(user2).changeWL(true)).to.be.revertedWith(
			'Ownable: caller is not the owner'
		);
	});

	it('recoverERC20', async function () {
		await expect(bountyManager.connect(user2).recoverERC20(user1.address, 10)).to.be.revertedWith(
			'Ownable: caller is not the owner'
		);
		await weth.deposit({ value: ethers.utils.parseEther('1') });
		await weth.transfer(bountyManager.address, ethers.utils.parseEther('1'));
		await bountyManager.recoverERC20(weth.address, 1);
	});

	// TODO: this .sol file currently commented out, temp disable test
	it('can remap bounties after contract upgrade', async () => {
		let quote = await bountyManager.connect(hunter).quote(user1.address);

		await generatePlatformRevenue();
		const pending1 = await multiFeeDistribution.claimableRewards(user1.address);
		pendingWeth = pending1.filter((entry) => entry.token === deployData.allTokens['rWETH'])[0].amount;
		// let quote2 = await bountyManager.connect(hunter).executeBounty(user1.address, false, 0);

		quote = await bountyManager.connect(hunter).quote(user1.address);
		// let quote2 = await bountyManager.connect(hunter).executeBounty(user1.address, false, 0);
		// console.log(quote2);
		await bountyManager.connect(hunter).claim(user1.address, quote.actionType);
		const bountyReceived = toNum((await multiFeeDistribution.earnedBalances(hunter.address)).totalVesting);

		/* const BountyManagerFactory = await ethers.getContractFactory(
            "BountyManagerBountiesUpgradeTest"
        );

        bountyManager = await upgrades.forceImport(bountyManager.address, BountyManagerFactory) as BountyManager;

        bountyManager = await upgrades.upgradeProxy(
            bountyManager,
            BountyManagerFactory
        ) as BountyManager;
            */
		await generatePlatformRevenue();
		// await expect(bountyManager.connect(hunter).quote(user1.address)).to.be.reverted;

		// await bountyManager.setBounties();

		quote = await bountyManager.connect(hunter).quote(user1.address);
		expect(toNum(quote[0])).gt(0);
	});

	it('can set minStakeAmount, minDLPBalance scales to minStakeAmount', async () => {
		const lpTokenPriceUsd = (await priceProvider.getLpTokenPriceUsd()).mul(10 ** 10);
		const minStakeAmount = await bountyManager.minStakeAmount();
		const minDLPBalance = await bountyManager.minDLPBalance();
		const expectedMinDLPBalance = minStakeAmount.mul(ethers.utils.parseEther('1')).div(lpTokenPriceUsd);
		expect(minDLPBalance).equals(expectedMinDLPBalance);

		await bountyManager.setMinStakeAmount(minStakeAmount.mul(10));
		const newMinDLPBalance = await bountyManager.minDLPBalance();
		expect(newMinDLPBalance).closeTo(minDLPBalance.mul(10), 10);
	});

	it('can be gated by a whitelist', async () => {
		await bountyManager.connect(deployer).changeWL(true);
		await expect(bountyManager.connect(hunter).executeBounty(user1.address, false, 0)).to.be.revertedWith(
			'NotWhitelisted'
		);
		await bountyManager.connect(deployer).addAddressToWL(hunter.address, true);
		await expect(bountyManager.connect(hunter).executeBounty(user1.address, false, 0)).to.not.be.reverted;

		await bountyManager.connect(deployer).changeWL(false);
		let quote = await bountyManager.connect(hunter).quote(user1.address);
		await bountyManager.connect(deployer).changeWL(true);
		quote = await bountyManager.connect(hunter).quote(user1.address);
	});

	it('fail when exceeding the value boundaries', async () => {
		await expect(bountyManager.connect(hunter).executeBounty(user1.address, false, 4)).to.be.revertedWith(
			'ActionTypeIndexOutOfBounds'
		);
	});
});
