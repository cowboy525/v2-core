import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import hre, {ethers, upgrades} from 'hardhat';
import {BalancerPoolHelper, RadiantOFT, WETH} from '../../typechain';
import {DeployConfig} from '../../scripts/deploy/types';
import {getConfigForChain} from '../../scripts/deploy/helpers/getConfig';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
import {BigNumber} from 'ethers';
chai.use(solidity);
const {expect} = chai;

async function deployContract(contractName: string, opts: any, ...args: any) {
	const factory = await ethers.getContractFactory(contractName, opts);
	const contract = await factory.deploy(...args);
	await contract.deployed();
	return contract;
}

describe('Balancer Pool Helper', function () {
	let preTestSnapshotID: any;
	let deployConfig: DeployConfig;

	let deployer: SignerWithAddress;
	let dao: SignerWithAddress;
	let treasury: SignerWithAddress;

	let poolHelper: BalancerPoolHelper;
	let wethContract: WETH;
	let radiantToken: RadiantOFT;

	const pool1EthAmt = 5000;
	const pool1OtherAmt = pool1EthAmt * 4;

	const ethAmt = ethers.utils.parseUnits('1', 18);
	const rdntAmt = ethers.utils.parseUnits('40', 18);
	const eightyPercent = ethers.BigNumber.from('800000000000000000');
	const twentyPercent = ethers.BigNumber.from('200000000000000000');
	const tokenWeights = [eightyPercent, twentyPercent];

	beforeEach(async function () {
		preTestSnapshotID = await hre.network.provider.send('evm_snapshot');

		const {chainId} = await ethers.provider.getNetwork();
		deployConfig = getConfigForChain(chainId);

		[deployer, dao, treasury] = await ethers.getSigners();

		wethContract = <WETH>await deployContract('WETH', {});

		radiantToken = <RadiantOFT>(
			await deployContract(
				'RadiantOFT',
				{},
				deployConfig.TOKEN_NAME,
				deployConfig.SYMBOL,
				deployConfig.LZ_ENDPOINT,
				dao.address,
				treasury.address,
				deployConfig.MINT_AMT
			)
		);

		const poolHelperFactory = await ethers.getContractFactory('BalancerPoolHelper');
		poolHelper = <BalancerPoolHelper>(
			await upgrades.deployProxy(
				poolHelperFactory,
				[
					wethContract.address,
					radiantToken.address,
					wethContract.address,
					deployConfig.BAL_VAULT,
					deployConfig.BAL_WEIGHTED_POOL_FACTORY,
				],
				{initializer: 'initialize', unsafeAllow: ['constructor']}
			)
		);
		await poolHelper.deployed();
		await wethContract.deposit({
			value: ethAmt,
		});

		await wethContract.transfer(poolHelper.address, ethAmt);

		await radiantToken.connect(dao).transfer(poolHelper.address, rdntAmt);
		await radiantToken.connect(dao).transfer(deployer.address, deployConfig.LP_INIT_RDNT);

		await poolHelper.initializePool('RDNT-WETH', 'RDNTLP');
		await poolHelper.setLockZap(deployer.address);

		await wethContract.approve(poolHelper.address, ethers.constants.MaxUint256);
		await radiantToken.approve(poolHelper.address, ethers.constants.MaxUint256);
	});

	describe('initializePool', async () => {
		it('initializePool with different order', async () => {
			const poolHelperFactory = await ethers.getContractFactory('BalancerPoolHelper');
			const newPoolHelper = <BalancerPoolHelper>(
				await upgrades.deployProxy(
					poolHelperFactory,
					[
						wethContract.address,
						radiantToken.address,
						wethContract.address,
						deployConfig.BAL_VAULT,
						deployConfig.BAL_WEIGHTED_POOL_FACTORY,
					],
					{initializer: 'initialize', unsafeAllow: ['constructor']}
				)
			);
			await newPoolHelper.deployed();

			await wethContract.deposit({
				value: deployConfig.LP_INIT_ETH,
			});
			await wethContract.transfer(newPoolHelper.address, deployConfig.LP_INIT_ETH);
			await radiantToken.connect(dao).transfer(newPoolHelper.address, deployConfig.LP_INIT_RDNT);

			await newPoolHelper.initializePool('RDNT-WETH', 'RDNTLP');
			await newPoolHelper.setLockZap(deployer.address);

			const amount = ethers.utils.parseUnits('1', 18);
			await wethContract.deposit({
				value: amount.mul(10),
			});
			await wethContract.approve(newPoolHelper.address, ethers.constants.MaxUint256);
			await radiantToken.connect(dao).transfer(newPoolHelper.address, ethers.utils.parseUnits('100000', 18));
			await newPoolHelper.zapWETH(amount);
		});

		it('Only owner can initialize', async () => {
			const poolHelperFactory = await ethers.getContractFactory('BalancerPoolHelper');
			// Deploy 
			const newPoolHelper = <BalancerPoolHelper>(
				await upgrades.deployProxy(
					poolHelperFactory,
					[
						wethContract.address,
						radiantToken.address,
						wethContract.address,
						deployConfig.BAL_VAULT,
						deployConfig.BAL_WEIGHTED_POOL_FACTORY,
					],
					{initializer: 'initialize'}
				)
			);

			await expect(newPoolHelper.connect(dao).initializePool('RDNT-WETH', 'RDNTLP')).to.be.revertedWith("Ownable: caller is not the owner");
		});

		it('sortTokens: IDENTICAL_ADDRESSES', async () => {
			const poolHelperFactory = await ethers.getContractFactory('BalancerPoolHelper');
			poolHelper = <BalancerPoolHelper>(
				await upgrades.deployProxy(
					poolHelperFactory,
					[
						radiantToken.address,
						radiantToken.address,
						wethContract.address,
						deployConfig.BAL_VAULT,
						deployConfig.BAL_WEIGHTED_POOL_FACTORY,
					],
					{initializer: 'initialize', unsafeAllow: ['constructor']}
				)
			);
			await poolHelper.deployed();
			await expect(poolHelper.initializePool('RDNT-WETH', 'RDNTLP')).to.be.revertedWith('IdenticalAddresses');
		});

		it('sortTokens: ZERO_ADDRESS', async () => {
			const poolHelperFactory = await ethers.getContractFactory('BalancerPoolHelper');
			await expect(
				upgrades.deployProxy(
					poolHelperFactory,
					[
						ethers.constants.AddressZero,
						radiantToken.address,
						wethContract.address,
						deployConfig.BAL_VAULT,
						deployConfig.BAL_WEIGHTED_POOL_FACTORY,
					],
					{initializer: 'initialize', unsafeAllow: ['constructor']}
				)
			).to.be.revertedWith('AddressZero');
		});
	});

	it('check LP Price', async () => {
		const lpAddr = await poolHelper.lpTokenAddr();
		const lpToken = await ethers.getContractAt('ERC20', lpAddr);
		const lpSupply = await lpToken.totalSupply();

		const rdntPriceInEth = BigNumber.from('10000000');
		const ethPriceInEth = BigNumber.from('100000000');

		const lpPrice = await poolHelper.getLpPrice(rdntPriceInEth);

		const expectedPrice = rdntPriceInEth.mul(rdntAmt).add(ethPriceInEth.mul(ethAmt)).div(lpSupply);
		expect(lpPrice).to.be.equal(expectedPrice);
	});

	it('Other functions work', async () => {
		expect(await poolHelper.quoteFromToken('100000000000000')).to.be.gt(0);

		const amount = ethers.utils.parseUnits('1', 18);

		await wethContract.deposit({
			value: amount.mul(10),
		});
		await poolHelper.zapWETH(amount);
		await poolHelper.zapTokens(amount, amount);
	});

	afterEach(async () => {
		await hre.network.provider.send('evm_revert', [preTestSnapshotID]);
	});
});
