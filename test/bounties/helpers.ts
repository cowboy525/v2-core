import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {BigNumber} from 'ethers';
import {ethers} from 'hardhat';
import {DeployData} from '../../scripts/deploy/types';
import {VariableDebtToken, LendingPool, AToken, WETH, MockToken} from '../../typechain';
import {getLatestBlockTimestamp} from '../shared/helpers';

export const zap = async (
	user: SignerWithAddress,
	deployData: DeployData,
	borrow: boolean,
	defaultLockTime: number
) => {
	const lockZap = await ethers.getContractAt('TestnetLockZap', deployData.lockZap);
	const debtTokenAddress = await lockZap.getVDebtToken(deployData.baseAssetWrappedAddress);
	const vdWETH = <VariableDebtToken>await ethers.getContractAt('VariableDebtToken', debtTokenAddress);
	await (await vdWETH.connect(user).approveDelegation(lockZap.address, ethers.constants.MaxUint256)).wait();
	const amountEth: string = '40'; //enough to eligible 1 mil usdc
	if (borrow) {
		await (
			await lockZap
				.connect(user)
				.zapOnBehalf(borrow, ethers.utils.parseEther(amountEth), defaultLockTime, user.address)
		).wait();
	} else {
		await lockZap.connect(user).zap(false, 0, 0, defaultLockTime, {
			value: ethers.utils.parseEther(amountEth),
		});
	}
};

export const deposit = async (
	ticker: string,
	amount: string,
	user: SignerWithAddress,
	lendingPool: LendingPool,
	deployData: DeployData
) => {
	if (amount === '0') return;

	const token = <AToken>await ethers.getContractAt('AToken', deployData.allTokens[ticker]);
	const underlying = await token.UNDERLYING_ASSET_ADDRESS();
	let asset;
	let amt;
	if (ticker === 'rWETH') {
		asset = <WETH>await ethers.getContractAt('WETH', underlying);
		amt = ethers.utils.parseUnits(amount, 18);
		await asset.connect(user).mint(amt);
	} else {
		asset = <MockToken>await ethers.getContractAt('MockToken', underlying);
		// hard code usdc
		amt = ethers.utils.parseUnits(amount, 6);
		await asset.mint(user.address, amt);
	}

	await asset.connect(user).approve(lendingPool.address, ethers.constants.MaxUint256);
	await (await lendingPool.connect(user).deposit(asset.address, amt, user.address, 0)).wait();
};

export const doBorrow = async (
	ticker: string,
	amount: string,
	user: SignerWithAddress,
	lendingPool: LendingPool,
	deployData: DeployData
) => {
	const token = <AToken>await ethers.getContractAt('AToken', deployData.allTokens[ticker]);
	const underlying = await token.UNDERLYING_ASSET_ADDRESS();
	let asset;
	let amt;
	if (ticker === 'rWETH') {
		asset = <WETH>await ethers.getContractAt('WETH', underlying);
		amt = ethers.utils.parseUnits(amount, 18);
		// await asset.connect(user).mint(amt);
	} else {
		asset = <MockToken>await ethers.getContractAt('MockToken', underlying);
		// hard code usdc
		amt = ethers.utils.parseUnits(amount, 6);
		// await asset.mint(user.address, amt);
	}
	// await asset.connect(user).approve(lendingPool.address, ethers.constants.MaxUint256);
	await (await lendingPool.connect(user).borrow(asset.address, amt, 2, 0, user.address)).wait();
};

export const now = async () => {
	return await getLatestBlockTimestamp();
};

export const toNum = (bn: BigNumber) => {
	return parseFloat(ethers.utils.formatEther(bn));
};
