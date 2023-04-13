import {ethers} from 'hardhat';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
import {LockZap, LendingPool, RadiantOFT, MockToken} from '../../typechain';
chai.use(solidity);
import {DeployConfig} from '../../scripts/deploy/types';
const {expect} = chai;
const {deployments, getNamedAccounts, network} = hre;

describe('Zapper', function () {
	let deployer: string;

	beforeEach(async function () {
		const accounts = await getNamedAccounts();
		deployer = accounts.deployer;
	});

	describe('Alternate token zap - Live Arbitrum', async () => {
		it('Can zap USDC - Live Arbitrum', async () => {
			const realWethAddress = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
			const balancerVault = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';
			const weightedPoolFactory = '0xf1665E19bc105BE4EDD3739F88315cC699cc5b65';

			const BalancerPoolHelper = await ethers.getContractFactory('BalancerPoolHelper');

			const poolHelper = await hre.upgrades.deployProxy(
				BalancerPoolHelper,
				[realWethAddress, realWethAddress, realWethAddress, balancerVault, weightedPoolFactory],
				{kind: 'transparent'}
			);
			await poolHelper.deployed();

			const zapAmount = ethers.BigNumber.from(100 * 10 ** 6);
			const usdcAddress = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8';
			const usdcOwnerAddress = '0x0688a02e26242b63372c0db0412904344ca9d00e';

			await network.provider.request({
				method: 'hardhat_impersonateAccount',
				params: [usdcOwnerAddress],
			});

			const realUSDC = await ethers.getContractAt('ERC20', usdcAddress);
			const usdcOwner = ethers.provider.getSigner(usdcOwnerAddress);
			await realUSDC.connect(usdcOwner).transfer(poolHelper.address, zapAmount);

			await poolHelper.swapToWeth(usdcAddress, zapAmount, 0);
		});
	});
	it('Can zap USDT & DAI - Live Arbitrum', async () => {
		const realWethAddress = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
		const balancerVault = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';
		const weightedPoolFactory = '0xf1665E19bc105BE4EDD3739F88315cC699cc5b65';

		const BalancerPoolHelper = await ethers.getContractFactory('BalancerPoolHelper');

		const poolHelper = await hre.upgrades.deployProxy(
			BalancerPoolHelper,
			[
				realWethAddress,
				realWethAddress, // wrong, but doesn't matter in this test
				realWethAddress,
				balancerVault,
				weightedPoolFactory,
			],
			{kind: 'transparent'}
		);
		await poolHelper.deployed();

		const zapAmount = ethers.BigNumber.from(100 * 10 ** 6);

		const usdtAddress = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9';
		const usdtOwnerAddress = '0xF2dbC42875E7764EDBd89732A15214A9a0Deb085';

		await network.provider.request({
			method: 'hardhat_impersonateAccount',
			params: [usdtOwnerAddress],
		});

		const realUSDT = await ethers.getContractAt('ERC20', usdtAddress);

		const usdtOwner = ethers.provider.getSigner(usdtOwnerAddress);
		await realUSDT.connect(usdtOwner).transfer(poolHelper.address, zapAmount);

		const chainlinkAggregatorEthAddress = '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612';
		const chainlinkAggregatorEth = await ethers.getContractAt(
			'IChainlinkAggregator',
			chainlinkAggregatorEthAddress
		);
		const ethPrice = await chainlinkAggregatorEth.latestAnswer();

		const zapAmount18Decimals = zapAmount.mul(10 ** 12);
		const ethPrice18Decimals = ethPrice.mul(10 ** 10);
		const unit = ethers.utils.parseUnits('1', 'ether');
		const expectedWeth = unit.mul(zapAmount18Decimals).div(ethPrice18Decimals);
		const acceptableRatio = 9500;
		const ratioDivisor = 10_000;

		const minAcceptableWeth = expectedWeth.mul(acceptableRatio).div(ratioDivisor);
		const weth = await ethers.getContractAt('ERC20', realWethAddress);
		const wethBalanceBefore = await weth.balanceOf(usdtOwnerAddress);
		await poolHelper.connect(usdtOwner).swapToWeth(usdtAddress, zapAmount, minAcceptableWeth);
		const wethBalanceAfter = await weth.balanceOf(usdtOwnerAddress);

		const wethGained = wethBalanceAfter.sub(wethBalanceBefore);
		expect(wethGained).to.be.gte(expectedWeth.mul(9500).div(10_000));
	});
});
