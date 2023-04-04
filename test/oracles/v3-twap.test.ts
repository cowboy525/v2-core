import {ethers} from 'hardhat';
import _ from 'lodash';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
import {advanceTimeAndBlock} from '../shared/helpers';
import {BigNumber} from 'ethers';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {Contract} from 'ethers';
import {ERC20, IUniswapV3Pool, UniV3TwapOracle, WETH} from '../../typechain';
const SwapRouterABI = require('./interfaces/ISwapRouter.json');
const {deployments} = require('hardhat');

chai.use(solidity);
const {expect} = chai;

/*
 *
 * This test uses a UniV3 pool deployed on Arbi
 * ensure hardhat fork config is forking Arbi
 *
 */
xdescribe('Uni V3 TWAP', () => {
	let oracle: UniV3TwapOracle;
	let owner: SignerWithAddress;
	let wethContract: WETH;
	let magic: ERC20;
	let router: Contract;
	let fee: number;

	const twapPeriod = 1200;

	const magicPair = '0x7e7fb3cceca5f2ac952edf221fd2a9f62e411980';
	const magicAddr = '0x539bde0d7dbd336b79148aa742883198bbf60342';
	const wethAddr = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
	const routerAddr = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
	const ethFeed = '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612';

	before(async () => {
		const {deploy} = deployments;
		owner = (await ethers.getSigners())[0];

		await deploy('UniV3TwapOracle', {
			from: owner.address,
			log: true,
			proxy: {
				proxyContract: 'OpenZeppelinTransparentProxy',
				execute: {
					methodName: 'initialize',
					args: [magicPair, magicAddr, ethFeed, twapPeriod],
				},
			},
		});

		const pair = <IUniswapV3Pool>(
			await ethers.getContractAt(
				'@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol:IUniswapV3Pool',
				magicPair
			)
		);
		fee = await pair.fee();

		router = new ethers.Contract(routerAddr, SwapRouterABI, ethers.provider);
		oracle = <UniV3TwapOracle>await ethers.getContract('UniV3TwapOracle');
		wethContract = await ethers.getContractAt('WETH', wethAddr);
		magic = await ethers.getContractAt('ERC20', magicAddr);
		await wethContract.connect(owner).approve(routerAddr, ethers.constants.MaxUint256);
	});

	it('returns price', async () => {
		await advanceTimeAndBlock(twapPeriod);

		const price0 = await oracle.latestAnswer();
		expect(Number(ethers.utils.formatUnits(price0, 8))).not.equals(0);
	});

	it('LP token change reflected in price after update', async () => {
		const price0 = await oracle.latestAnswer();
		const wethInPair0 = await wethContract.balanceOf(magicPair);
		const magicInPair0 = await magic.balanceOf(magicPair);

		const depositAmt = ethers.utils.parseEther('3000');
		const swapParams = {
			tokenIn: wethAddr,
			tokenOut: magicAddr,
			fee,
			recipient: owner.address,
			deadline: Math.floor(Date.now() / 1000) + 60 * 10000,
			amountIn: depositAmt,
			amountOutMinimum: 0,
			sqrtPriceLimitX96: 0,
		};

		for (let i = 0; i < 2; i++) {
			await wethContract.connect(owner).deposit({value: depositAmt});

			const balanceWETH = await wethContract.balanceOf(owner.address);
			expect(balanceWETH).to.be.equal(depositAmt);

			const swapGasPrice = await ethers.provider.getFeeData();
			try {
				const tx = await router.connect(owner).exactInputSingle(swapParams, {
					maxFeePerGas: swapGasPrice.maxFeePerGas,
					maxPriorityFeePerGas: swapGasPrice.maxPriorityFeePerGas,
					gasLimit: 5000000,
				});
				await tx.wait();
				// console.log("TRANSACTION HASH SWAP: " + tx.hash)
			} catch (error) {
				// console.error("Error executing swap:", error.message);
			}

			const balanceWETH2 = await wethContract.balanceOf(owner.address);
			expect(balanceWETH2).to.be.equal(0);

			await advanceTimeAndBlock(twapPeriod);
		}

		const price1 = await oracle.latestAnswer();
		const wethInPair1 = await wethContract.balanceOf(magicPair);
		const magicInPair1 = await magic.balanceOf(magicPair);

		const minPrice1 = magicInPair0.div(wethInPair0).div(magicInPair1.div(wethInPair1)).mul(price0);
		expect(price1).to.be.gt(minPrice1);
	});
});
