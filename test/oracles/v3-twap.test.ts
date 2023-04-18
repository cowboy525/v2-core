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
describe('Uni V3 TWAP', () => {
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
});
