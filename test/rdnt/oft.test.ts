import { EtherscanProvider } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { LZEndpointMock, MockPriceProvider, RadiantOFT } from "../../typechain-types"
import { advanceTimeAndBlock } from "../shared/helpers";
chai.use(solidity);
const { expect } = chai;

// TODO: match new mint + bridge interface
xdescribe("Radiant OFT: ", function () {
    const chainIdSrc = 1
    const chainIdDst = 2
    const name = "Radiant OFT"
    const symbol = "OFT"
    const srcSupply = ethers.utils.parseUnits("1000000", 18)
    const dstSupply = ethers.utils.parseUnits("500000", 18)
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
    let priceProvider: MockPriceProvider;

    before(async function () {
        owner = (await ethers.getSigners())[0]
        dao = (await ethers.getSigners())[1]
        trez = (await ethers.getSigners())[1]
        warlock = (await ethers.getSigners())[1]
    })

    beforeEach(async function () {
        const LZEndpointMockFactory = await ethers.getContractFactory("LZEndpointMock")
        const RadiantOftFactroy = await ethers.getContractFactory("RadiantOFT");

        lzEndpointSrcMock = await LZEndpointMockFactory.deploy(chainIdSrc)
        lzEndpointDstMock = await LZEndpointMockFactory.deploy(chainIdDst)

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

        const mockPriceProviderFactory = await ethers.getContractFactory("MockPriceProvider");
        priceProvider = await mockPriceProviderFactory.deploy();
        await priceProvider.deployed();
    })

    it("sendFrom()", async function () {
        // ensure they're both starting with correct amounts
        expect(await OFTSrc.balanceOf(dao.address)).to.be.equal(srcSupply)
        expect(await OFTDst.balanceOf(dao.address)).to.be.equal("0")

        // can transfer accross chain
        await OFTSrc.sendFrom(
            owner.address,
            chainIdDst,
            ethers.utils.solidityPack(["address"], [owner.address]),
            sendQty,
            owner.address,
            ethers.constants.AddressZero,
            "0x"
        )

        await expect(
            OFTSrc.estimateSendFee(
                chainIdDst,
                owner.address,
                sendQty,
                true,
                "0x"
            )
        ).to.be.not.reverted;

        // verify tokens burned on source chain and minted on destination chain
        expect(await OFTSrc.balanceOf(owner.address)).to.be.equal(srcSupply.sub(sendQty))
        expect(await OFTDst.balanceOf(owner.address)).to.be.equal(sendQty)
    })

    it("bridge()", async function () {
        await OFTSrc.setFee(1000);
        await OFTSrc.setPriceProvider(priceProvider.address);
        await advanceTimeAndBlock(3601);
        await priceProvider.update();

        // ensure they're both starting with correct amounts
        expect(await OFTSrc.balanceOf(owner.address)).to.be.equal(srcSupply)
        expect(await OFTDst.balanceOf(owner.address)).to.be.equal("0")

        const priceInEth = await priceProvider.getTokenPrice();
        const priceDecimals = await priceProvider.decimals();

        const fee = await OFTSrc.getBridgeFee(sendQty);
        const expectedFee = sendQty.mul(priceInEth).div(BigNumber.from(10).pow(priceDecimals)).mul(1000).div(10_000)
        expect(fee).to.be.equal(expectedFee);

        const beforeTreasuryBalance = await warlock.getBalance();
        // can transfer accross chain
        await OFTSrc.bridge(
            sendQty,
            chainIdDst,
            { value: fee }
        )
        const afterTreasuryBalance = await warlock.getBalance();

        expect(afterTreasuryBalance.sub(beforeTreasuryBalance)).to.be.equal(fee)

        // verify tokens burned on source chain and minted on destination chain
        expect(await OFTSrc.balanceOf(owner.address)).to.be.equal(srcSupply.sub(sendQty))
        expect(await OFTDst.balanceOf(owner.address)).to.be.equal(sendQty)
    })

    it("bridge fails if exceeds max supply", async function () {
        // ensure they're both starting with correct amounts
        expect(await OFTSrc.balanceOf(owner.address)).to.be.equal(srcSupply)
        expect(await OFTDst.balanceOf(owner.address)).to.be.equal("0")

        const sendAmount = dstSupply.add(1);

        // can transfer accross chain
        await OFTSrc.bridge(
            sendAmount,
            chainIdDst
        )

        // verify tokens burned on source chain and minted on destination chain
        expect(await OFTSrc.balanceOf(owner.address)).to.be.equal(srcSupply.sub(sendAmount))

        // still zero, cuz dst chain txn failed
        expect(await OFTDst.balanceOf(owner.address)).to.be.equal("0")
    })

    it("pauseBridge()", async function () {
        // pause the transfers
        await OFTDst.pause()

        // transfer to the paused chain are not paused. Only outbound
        await OFTSrc.sendFrom(
            owner.address,
            chainIdDst,
            ethers.utils.solidityPack(["address"], [owner.address]),
            sendQty,
            owner.address,
            ethers.constants.AddressZero,
            "0x"
        )

        // verify tokens burned on source chain and minted on destination chain
        expect(await OFTSrc.balanceOf(owner.address)).to.be.equal(srcSupply.sub(sendQty))
        expect(await OFTDst.balanceOf(owner.address)).to.be.equal(sendQty)

        // cannot transfer back across chain due to pause
        await expect(
            OFTDst.sendFrom(
                owner.address,
                chainIdSrc,
                ethers.utils.solidityPack(["address"], [owner.address]),
                sendQty,
                owner.address,
                ethers.constants.AddressZero,
                "0x"
            )
        ).to.be.revertedWith("Pausable: paused")

        await expect(
            OFTDst.bridge(
                sendQty,
                chainIdSrc
            )
        ).to.be.revertedWith("Pausable: paused")

        // verify tokens were not modified
        expect(await OFTSrc.balanceOf(owner.address)).to.be.equal(srcSupply.sub(sendQty))
        expect(await OFTDst.balanceOf(owner.address)).to.be.equal(sendQty)

        // unpause the transfers
        await OFTDst.pauseBridge(false)

        // transfer succeeds
        await OFTDst.sendFrom(
            owner.address,
            chainIdSrc,
            ethers.utils.solidityPack(["address"], [owner.address]),
            sendQty,
            owner.address,
            ethers.constants.AddressZero,
            "0x"
        )

        // verify tokens were sent back
        expect(await OFTSrc.balanceOf(owner.address)).to.be.equal(srcSupply)
        expect(await OFTDst.balanceOf(owner.address)).to.be.equal(0)
    })

    it("pauseBridge() - reverts if not owner", async function () {
        await expect(OFTDst.connect(warlock).pause()).to.be.revertedWith("Ownable: caller is not the owner")
    })
});