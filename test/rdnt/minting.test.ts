import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import chai from 'chai';
import {solidity} from 'ethereum-waffle';
import {ethers} from 'hardhat';
import {LZEndpointMock, RadiantOFT} from '../../typechain';
chai.use(solidity);
const {expect} = chai;

describe('Radiant token: ', function () {
	const chainIdSrc = 1;
	const chainIdDst = 2;
	const name = 'Radiant OFT';
	const symbol = 'OFT';
	const srcSupply = ethers.utils.parseUnits('1000000', 18);
	const dstSupply = ethers.utils.parseUnits('1000000', 18);
	const adapterParam = ethers.utils.solidityPack(['uint16', 'uint256'], [1, 225000]);
	const sendQty = ethers.utils.parseUnits('1', 18); // amount to be sent across

	let owner: SignerWithAddress;
	let warlock: SignerWithAddress;
	let dao: SignerWithAddress;
	let trez: SignerWithAddress;
	let lzEndpointSrcMock: LZEndpointMock;
	let lzEndpointDstMock: LZEndpointMock;
	let OFTSrc: RadiantOFT;
	let OFTDst: RadiantOFT;

	before(async function () {
		owner = (await ethers.getSigners())[0];
		dao = (await ethers.getSigners())[1];
		trez = (await ethers.getSigners())[2];
	});

	beforeEach(async function () {
		const LZEndpointMockFactory = await ethers.getContractFactory('LZEndpointMock');
		const RadiantOFT = await ethers.getContractFactory('RadiantOFT');

		lzEndpointSrcMock = await LZEndpointMockFactory.deploy(chainIdSrc);

		OFTSrc = await RadiantOFT.deploy(name, symbol, lzEndpointSrcMock.address, dao.address, trez.address, srcSupply);
	});

	it('can be burned', async function () {
		expect(await OFTSrc.balanceOf(dao.address)).to.be.gt('0');
		await OFTSrc.connect(dao).burn(await OFTSrc.balanceOf(dao.address));
		expect(await OFTSrc.balanceOf(owner.address)).to.be.equal('0');
	});
});
