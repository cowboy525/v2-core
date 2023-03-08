import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import hre, { ethers, upgrades } from "hardhat";
import { BalancerPoolHelper, RadiantOFT } from "../../typechain-types";
import { DeployConfig } from "../../scripts/deploy/types";
import { expect } from "chai";
import { WETH } from "../../typechain-types/contracts/misc/WETH.sol";
import { getConfigForChain } from "../../scripts/deploy/helpers/getConfig";
import { MockToken } from "../../typechain-types/mocks";

async function deployContract(contractName: string, opts: any, ...args: any) {
  const factory = await ethers.getContractFactory(contractName, opts);
  const contract = await factory.deploy(...args);
  await contract.deployed();
  return contract;
}

xdescribe("Balancer Pool Helper", function () {
  let preTestSnapshotID: any;
  let deployConfig: DeployConfig;

  let deployer: SignerWithAddress;
  let dao: SignerWithAddress;

  let poolHelper: BalancerPoolHelper;
  let wstETHPoolHelper: BalancerPoolHelper;
  let wethContract: WETH;
  let radiantToken: RadiantOFT;
  let wstWETHPoolAddress: string;
  let wstkETH: MockToken;
  let wstETHToken: MockToken;

  const pool1EthAmt = 5000;
  const pool1OtherAmt = pool1EthAmt * 4;

  const ethAmt = ethers.utils.parseUnits(pool1EthAmt.toString(), 18);
  const wstkETHAmt = ethers.utils.parseUnits(pool1OtherAmt.toString(), 18);

  beforeEach(async function () {
    preTestSnapshotID = await hre.network.provider.send("evm_snapshot");

    const { chainId } = await ethers.provider.getNetwork();
    deployConfig = getConfigForChain(chainId);

    [deployer, dao] = await ethers.getSigners();

    wethContract = <WETH>await deployContract("WETH", {});
    wstkETH = <MockToken>(
      await deployContract("MockToken", {}, "wstkETH", "wstkETH", 18)
    );

    radiantToken = <RadiantOFT>(
      await deployContract(
        "RadiantOFT",
        {},
        deployConfig.TOKEN_NAME,
        deployConfig.SYMBOL,
        deployConfig.LZ_ENDPOINT,
        deployConfig.SUPPLY_MAX,
        deployConfig.SUPPLY_MAX_MINT,
        deployConfig.FEE_BRIDGING,
        deployConfig.TREASURY,
        dao.address
      )
    );

    const poolHelperFactory = await ethers.getContractFactory(
      "BalancerPoolHelper"
    );
    wstETHPoolHelper = <BalancerPoolHelper>(
      await upgrades.deployProxy(
        poolHelperFactory,
        [
          wethContract.address,
          wstkETH.address,
          wethContract.address,
          "0x0000000000000000000000000000000000000000",
          deployConfig.BAL_VAULT,
          deployConfig.BAL_WEIGHTED_POOL_FACTORY,
          "0x0000000000000000000000000000000000000000",
        ],
        { initializer: "initialize" }
      )
    );
    await wstETHPoolHelper.deployed();

    await wstkETH.mint(deployer.address, wstkETHAmt);
    await wethContract.deposit({
      value: ethAmt,
    });

    await wstkETH.transfer(wstETHPoolHelper.address, wstkETHAmt);
    await wethContract.transfer(wstETHPoolHelper.address, ethAmt);

    await wstETHPoolHelper.initializePool();

    wstWETHPoolAddress = await wstETHPoolHelper.lpTokenAddr();

    poolHelper = <BalancerPoolHelper>(
      await upgrades.deployProxy(
        poolHelperFactory,
        [
          wstkETH.address,
          radiantToken.address,
          wethContract.address,
          wstkETH.address,
          deployConfig.BAL_VAULT,
          deployConfig.BAL_WEIGHTED_POOL_FACTORY,
          wstWETHPoolAddress,
        ],
        { initializer: "initialize" }
      )
    );
    await poolHelper.deployed();

    wstETHToken = await ethers.getContractAt(
      "MockToken",
      wstkETH.address || "0x0"
    );

    const wstETHBalance = await wstETHToken.balanceOf(deployer.address);
    if (wstETHBalance.isZero()) {
      await wstETHToken.mint(deployer.address, deployConfig.LP_INIT_ETH);
    }
    await wstETHToken.transfer(poolHelper.address, deployConfig.LP_INIT_ETH);

    await radiantToken.mint();
    await radiantToken
      .connect(dao)
      .transfer(poolHelper.address, deployConfig.LP_INIT_RDNT);
    await radiantToken
      .connect(dao)
      .transfer(deployer.address, deployConfig.LP_INIT_RDNT);

    await poolHelper.initializePool();

    await wethContract.approve(poolHelper.address, ethers.constants.MaxUint256);
    await radiantToken.approve(poolHelper.address, ethers.constants.MaxUint256);
    await wstETHToken.approve(poolHelper.address, ethers.constants.MaxUint256);
  });

  describe("initializePool", async () => {
    it("initializePool with different order", async () => {
      const poolHelperFactory = await ethers.getContractFactory(
        "BalancerPoolHelper"
      );
      const newPoolHelper = <BalancerPoolHelper>(
        await upgrades.deployProxy(
          poolHelperFactory,
          [
            radiantToken.address,
            wstkETH.address,
            wethContract.address,
            wstkETH.address,
            deployConfig.BAL_VAULT,
            deployConfig.BAL_WEIGHTED_POOL_FACTORY,
            wstWETHPoolAddress,
          ],
          { initializer: "initialize" }
        )
      );
      await newPoolHelper.deployed();

      await wstETHToken.mint(deployer.address, deployConfig.LP_INIT_ETH);
      await wstETHToken.transfer(
        newPoolHelper.address,
        deployConfig.LP_INIT_ETH
      );
      await radiantToken
        .connect(dao)
        .transfer(newPoolHelper.address, deployConfig.LP_INIT_RDNT);

      await newPoolHelper.initializePool();

      const amount = ethers.utils.parseUnits("1", 18);
      await wethContract.deposit({
        value: amount.mul(10),
      });
      await wethContract.approve(
        newPoolHelper.address,
        ethers.constants.MaxUint256
      );
      await radiantToken
        .connect(dao)
        .transfer(newPoolHelper.address, ethers.utils.parseUnits("100000", 18));
      await newPoolHelper.zapWETH(amount);
    });

    it("sortTokens: IDENTICAL_ADDRESSES", async () => {
      const poolHelperFactory = await ethers.getContractFactory(
        "BalancerPoolHelper"
      );
      poolHelper = <BalancerPoolHelper>(
        await upgrades.deployProxy(
          poolHelperFactory,
          [
            radiantToken.address,
            radiantToken.address,
            wethContract.address,
            wstkETH.address,
            deployConfig.BAL_VAULT,
            deployConfig.BAL_WEIGHTED_POOL_FACTORY,
            wstWETHPoolAddress,
          ],
          { initializer: "initialize" }
        )
      );
      await poolHelper.deployed();
      await expect(poolHelper.initializePool()).to.be.revertedWith(
        "BalancerZap: IDENTICAL_ADDRESSES"
      );
    });

    it("sortTokens: ZERO_ADDRESS", async () => {
      const poolHelperFactory = await ethers.getContractFactory(
        "BalancerPoolHelper"
      );
      poolHelper = <BalancerPoolHelper>(
        await upgrades.deployProxy(
          poolHelperFactory,
          [
            ethers.constants.AddressZero,
            radiantToken.address,
            wethContract.address,
            wstkETH.address,
            deployConfig.BAL_VAULT,
            deployConfig.BAL_WEIGHTED_POOL_FACTORY,
            wstWETHPoolAddress,
          ],
          { initializer: "initialize" }
        )
      );
      await poolHelper.deployed();
      await expect(poolHelper.initializePool()).to.be.revertedWith(
        "BalancerZap: ZERO_ADDRESS"
      );
    });
  });

  it("Other functions work", async () => {
    expect(await poolHelper.quoteFromToken("100000000000000")).to.be.gt(0);

    const amount = ethers.utils.parseUnits("1", 18);

    await wethContract.deposit({
      value: amount.mul(10),
    });
    await poolHelper.zapWETH(amount);
    await poolHelper.zapTokens(amount, amount);
  });

  afterEach(async () => {
    await hre.network.provider.send("evm_revert", [preTestSnapshotID]);
  });
});
