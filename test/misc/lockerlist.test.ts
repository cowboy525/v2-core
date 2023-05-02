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
	let deployer: SignerWithAddress;
	let user1: SignerWithAddress;
	let user2: SignerWithAddress;
	let treasury: SignerWithAddress;
	let lockerlist: LockerList;

	beforeEach(async () => {
		[deployer, user1, user2, treasury] = await ethers.getSigners();

		const LockerList = await ethers.getContractFactory('LockerList');
		lockerlist = await LockerList.deploy();
		await lockerlist.deployed();
	});

	it('owner permission', async () => {
		await expect(lockerlist.connect(user1).addToList(deployer.address)).to.be.revertedWith("Ownable: caller is not the owner");
		await expect(lockerlist.connect(user1).removeFromList(deployer.address)).to.be.revertedWith("Ownable: caller is not the owner");
	});

	it("operations", async () => {
		await lockerlist.addToList(deployer.address);
		await lockerlist.addToList(user1.address);
		await lockerlist.addToList(user2.address);
		await lockerlist.addToList(treasury.address);
		await lockerlist.removeFromList(treasury.address);
		const lockers = await lockerlist.getUsers(2, 5);
		expect(lockers.length).to.be.equal(5);
		expect(lockers.filter((a) => a === ethers.constants.AddressZero).length).to.be.equal(5);
	});
});
