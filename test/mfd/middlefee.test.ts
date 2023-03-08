import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { DeployConfig } from "../../scripts/deploy/types";
import { CustomERC20, MiddleFeeDistribution, MultiFeeDistribution } from "../../typechain-types";
import { setupTest } from "../setup";

let config: DeployConfig;

describe("MiddleFeeDistribution", () => {
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let mfd: MultiFeeDistribution;
  let middle: MiddleFeeDistribution;
  let lfd: MultiFeeDistribution;
  let radiant: CustomERC20;
  let lp: CustomERC20;

  const amount = ethers.utils.parseUnits("10000000", 18);
  const mintAmount = ethers.utils.parseUnits("604800", 18);

  beforeEach(async () => {
    [deployer, user1, user2] = await ethers.getSigners();

    const fixture = await setupTest();

    radiant = fixture.rdntToken;
    mfd = fixture.multiFeeDistribution;
    lfd = fixture.lpFeeDistribution;
    middle = fixture.middleFeeDistribution;
    config = fixture.deployConfig;

    lp = await ethers.getContractAt("CustomERC20", await lfd.stakingToken());
  });

  it("setLpLockingRewardRatio", async () => {
    await expect(
      middle.connect(user1).setLpLockingRewardRatio(10)
    ).to.be.revertedWith("caller is not the admin or owner");
  });

  it("setLPFeeDistribution", async () => {
    await expect(
      middle.connect(user1).setLPFeeDistribution(lfd.address)
    ).to.be.revertedWith("caller is not the admin or owner");
  });

  it("lockedBalances", async () => {
    const mfdLock = await mfd.lockedBalances(user1.address);
    const middleLock = await middle.lockedBalances(user1.address);
    expect(mfdLock.total).to.be.equal(middleLock.total);
    expect(mfdLock.unlockable).to.be.equal(middleLock.unlockable);
    expect(mfdLock.locked).to.be.equal(middleLock.locked);
  });
});

// Test with mock ownership
describe("MiddleFeeDistribution with mock deployment", () => {
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let lfd: SignerWithAddress;
  let mfd: any;
  let middle: any;
  let radiant: CustomERC20;
  let lp: CustomERC20;

  const amount = ethers.utils.parseUnits("10000000", 18);
  const MFD_REWARD_DURATION_SECS = 60;
  const MFD_REWARD_LOOKBACK_SECS = 30;
  const MFD_LOCK_DURATION_SECS = 2400;

  const mintAmount = ethers.utils.parseUnits("604800", 18);

  beforeEach(async () => {
    [deployer, user1, user2, lfd] = await ethers.getSigners();

    const erc20Factory = await ethers.getContractFactory("CustomERC20");
    radiant = <CustomERC20>await erc20Factory.deploy(amount);
    lp = <CustomERC20>await erc20Factory.deploy(amount);

    await radiant.transfer(user1.address, amount.div(10));
    await radiant.transfer(user2.address, amount.div(10));
    await lp.transfer(user1.address, amount.div(10));
    await lp.transfer(user2.address, amount.div(10));

    const mockPriceProviderFactory = await ethers.getContractFactory(
      "MockPriceProvider"
    );
    const priceProvider = await mockPriceProviderFactory.deploy();
    await priceProvider.deployed();

    const mfdFactory = await ethers.getContractFactory("MultiFeeDistribution");
    mfd = await upgrades.deployProxy(
      mfdFactory,
      [
        radiant.address,
        deployer.address, // Mock
        deployer.address, // Mock
        deployer.address, // Mock
        deployer.address, // Mock
        MFD_REWARD_DURATION_SECS,
        MFD_REWARD_LOOKBACK_SECS,
        MFD_LOCK_DURATION_SECS,
        0,
        config.MFD_VEST_DURATION,
      ],
      { initializer: "initialize" }
    );
    await mfd.deployed();
    await mfd.setLPToken(radiant.address);

    const middleFactory = await ethers.getContractFactory(
      "MiddleFeeDistribution"
    );
    middle = await upgrades.deployProxy(
      middleFactory,
      [radiant.address, ethers.constants.AddressZero, lfd.address, mfd.address],
      { initializer: "initialize" }
    );
    await middle.deployed();
  });

  it("recover ERC20", async () => {
    const mintAmount = ethers.utils.parseUnits("604800", 18);
    const erc20Factory = await ethers.getContractFactory("CustomERC20");
    const mockErc20 = <CustomERC20>await erc20Factory.deploy(amount);
    await mockErc20.mint(middle.address, mintAmount);
    expect(await mockErc20.balanceOf(middle.address)).to.be.equal(mintAmount);
    const balance = await mockErc20.balanceOf(deployer.address);
    await middle.recoverERC20(mockErc20.address, mintAmount);
    expect(await mockErc20.balanceOf(deployer.address)).to.be.equal(
      balance.add(mintAmount)
    );
  });

  it("tokens minted on Middle go to MFDs", async () => {
    await middle.setLpLockingRewardRatio(5000);

    await radiant.mint(middle.address, mintAmount);
    await middle.connect(lfd).forwardReward([radiant.address]);

    expect(await radiant.balanceOf(mfd.address)).to.be.equal(mintAmount.div(2));
    expect(await radiant.balanceOf(lfd.address)).to.be.equal(mintAmount.div(2));
  });

  it("tokens minted on Middle with custom lp ratio", async () => {
    // update ratio
    await middle.setLpLockingRewardRatio(0);
    await radiant.mint(middle.address, mintAmount);
    await middle.connect(lfd).forwardReward([radiant.address]);
    expect(await radiant.balanceOf(mfd.address)).to.be.equal(mintAmount);
  });
});
