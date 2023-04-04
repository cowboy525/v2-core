import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
import {BigNumber} from 'ethers';
import {ethers} from 'hardhat';
import {Migration} from '../../typechain';
import {CustomERC20} from '../../typechain/test';
chai.use(solidity);
const {expect} = chai;

xdescribe('Migration V1 -> V2', function () {
	let owner: SignerWithAddress;
	let user1: SignerWithAddress;

	let migration: Migration;
	let tokenV1: CustomERC20;
	let tokenV2: CustomERC20;

	const amount = ethers.utils.parseUnits('10000000', 18);

	before(async function () {
		[owner, user1] = await ethers.getSigners();

		const migrationFactory = await ethers.getContractFactory('Migration');
		const erc20Factory = await ethers.getContractFactory('CustomERC20');

		tokenV1 = await erc20Factory.deploy(amount);
		await tokenV1.deployed();
		tokenV2 = await erc20Factory.deploy(amount);
		await tokenV2.deployed();

		migration = await migrationFactory.deploy(tokenV1.address, tokenV2.address);
		await migration.deployed();

		await migration.unpause();
	});

	it('Prepare reserve', async () => {
		await tokenV1.mint(user1.address, amount);
		await tokenV2.mint(migration.address, amount);
	});

	it('Migrate tokens', async () => {
		const v1Amount = ethers.utils.parseUnits('10000', 18);
		const expectedV2Amount = v1Amount;
		await tokenV1.connect(user1).approve(migration.address, ethers.constants.MaxUint256);

		const v2Before = await tokenV2.balanceOf(user1.address);
		const v1Before = await tokenV1.balanceOf(migration.address);
		await migration.connect(user1).exchange(v1Amount);
		const v2After = await tokenV2.balanceOf(user1.address);
		const v1After = await tokenV1.balanceOf(migration.address);
		expect(v2After.sub(v2Before)).to.be.equal(expectedV2Amount);
		expect(v1After.sub(v1Before)).to.be.equal(v1Amount);
	});

	it('withdrawTokens', async function () {
		const all = await tokenV1.balanceOf(migration.address);
		await expect(migration.connect(user1).withdrawToken(tokenV1.address, all)).to.be.revertedWith(
			'Ownable: caller is not the owner'
		);

		const balance0 = await tokenV1.balanceOf(owner.address);
		await migration.withdrawToken(tokenV1.address, all);
		const balance1 = await tokenV1.balanceOf(owner.address);
		expect(all).to.be.equal(balance1.sub(balance0));
	});

	it('Pause action', async () => {
		await expect(migration.connect(user1).pause()).to.be.revertedWith('Ownable: caller is not the owner');
		await migration.pause();
		await expect(migration.connect(user1).exchange(10000)).to.be.revertedWith('Pausable: paused');
	});
});
