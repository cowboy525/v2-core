import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { LZEndpointMock, RadiantOFT } from "../../typechain-types"
chai.use(solidity);
const { expect } = chai;

describe("Radiant token: ", function () {
    const chainIdSrc = 1
    const chainIdDst = 2
    const name = "Radiant OFT"
    const symbol = "OFT"
    const srcSupply = ethers.utils.parseUnits("1000000", 18)
    const dstSupply = ethers.utils.parseUnits("1000000", 18)
    const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])
    const sendQty = ethers.utils.parseUnits("1", 18) // amount to be sent across

    let owner: SignerWithAddress;
    let warlock: SignerWithAddress;
    let dao: SignerWithAddress;
    let trez: SignerWithAddress;
    let lzEndpointSrcMock: LZEndpointMock;
    let lzEndpointDstMock: LZEndpointMock;
    let OFTSrc: RadiantOFT;
    let OFTDst: RadiantOFT;

    before(async function () {
        owner = (await ethers.getSigners())[0]
        dao = (await ethers.getSigners())[1]
        trez = (await ethers.getSigners())[2]
        warlock = (await ethers.getSigners())[3]

    })

    beforeEach(async function () {
        const LZEndpointMockFactory = await ethers.getContractFactory("LZEndpointMock")
        const RadiantOftFactroy = await ethers.getContractFactory("RadiantOFT");

        lzEndpointSrcMock = await LZEndpointMockFactory.deploy(chainIdSrc)
        lzEndpointDstMock = await LZEndpointMockFactory.deploy(chainIdDst)

        // create two oft instances
        // create two oft instances
        OFTSrc = await RadiantOftFactroy.deploy(name, symbol, lzEndpointSrcMock.address, dao.address, trez.address, srcSupply);
        OFTDst = await RadiantOftFactroy.deploy(name, symbol, lzEndpointSrcMock.address, dao.address, trez.address, srcSupply);

        // internal bookkeeping for endpoints (not part of a real deploy, just for this test)
        await lzEndpointSrcMock.setDestLzEndpoint(OFTDst.address, lzEndpointDstMock.address)
        await lzEndpointDstMock.setDestLzEndpoint(OFTSrc.address, lzEndpointSrcMock.address)

        // set each contracts source address so it can send to each other
        await OFTSrc.setTrustedRemote(chainIdDst, OFTDst.address) // for A, set B
        await OFTDst.setTrustedRemote(chainIdSrc, OFTSrc.address) // for B, set A

        //set destination min gas
        // await OFTSrc.setMinDstGasLookup(chainIdDst, await OFTSrc.FUNCTION_TYPE_SEND(), 225000)
        // await OFTDst.setMinDstGasLookup(chainIdSrc, await OFTDst.FUNCTION_TYPE_SEND(), 225000)

        // await OFTSrc.setUseCustomAdapterParams(true)
        // await OFTDst.setUseCustomAdapterParams(true)
    })

    // TODO: mint() removed, create similar test
    xit("mint fails for regular user", async function () {
        expect(await OFTSrc.balanceOf(warlock.address)).to.be.equal("0")
        await expect(
            OFTSrc.connect(warlock).mint()
        ).to.be.revertedWith("mint disabled")
    })

    it("can be burned", async function () {
        expect(await OFTSrc.balanceOf(dao.address)).to.be.gt("0");
        await OFTSrc.connect(dao).burn(await OFTSrc.balanceOf(dao.address));
        expect(await OFTSrc.balanceOf(owner.address)).to.be.equal("0");
    })
});