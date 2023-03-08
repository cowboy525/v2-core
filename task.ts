import { task } from "hardhat/config";
import { DeployData } from "./scripts/deploy/types";
import fs from "fs";

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

task("updateAllocPoints", "Updates allocation points")
  .addParam("chefIncentivesControllerAddress")
  .addParam("tokens", "Tokens")
  .addParam("allocPoints", "Allocation points")
  .setAction(async (taskArgs, hre) => {
    const ChefIncentivesControllerFactory = await hre.ethers.getContractFactory(
      "ChefIncentivesController"
    );
    const chefIncentivesControllerContract =
      ChefIncentivesControllerFactory.attach(
        taskArgs.chefIncentivesControllerAddress
      );
    const receipt =
      await chefIncentivesControllerContract.batchUpdateAllocPoint(
        taskArgs.tokens.split(","),
        taskArgs.allocPoints.split(",")
      );

    await receipt.wait();
    console.log("Allocation points updated!");
  });

task(
  "deployNewAsset",
  "Deploy A token, Debt Tokens, Risk Parameters and configure asset"
)
  .addParam("symbol", "Asset symbol, needs to have configuration ready")
  .addParam("reserveAssetAddress", "Reserve asset Address")
  .addParam("decimals", "Decimals")
  .addParam("allocPoint", "Allocation point")
  .addParam("ltv", "LTV")
  .addParam("liquidationThreshold", "Liquidation threshold")
  .addParam("liquidationBonus", "Liquidation bonus")
  .addParam("reserveFactor", "Reserve factor")
  .addParam("chainlinkAggregator", "Chainlink aggregator")
  .addParam(
    "lendingPoolAddressesProviderAddress",
    "LendingPoolAddressesProvider Address"
  )
  .addParam(
    "chefIncentivesControllerAddress",
    "ChefIncentivesController Address"
  )
  .addParam("multiFeeDistributionAddress", "MultiFeeDistribution Address")
  .setAction(
    async (
      {
        symbol,
        reserveAssetAddress,
        decimals,
        allocPoint,
        ltv,
        liquidationThreshold,
        liquidationBonus,
        reserveFactor,
        chainlinkAggregator,
        lendingPoolAddressesProviderAddress,
        chefIncentivesControllerAddress,
        multiFeeDistributionAddress,
      },
      hre
    ) => {
      const init = {
        aTokenImpl: "0x0000000000000000000000000000000000000000",
        stableDebtTokenImpl: "0x0000000000000000000000000000000000000000",
        variableDebtTokenImpl: "0x0000000000000000000000000000000000000000",
        underlyingAssetDecimals: decimals,
        interestRateStrategyAddress:
          "0x0000000000000000000000000000000000000000",
        underlyingAsset: reserveAssetAddress,
        treasury: multiFeeDistributionAddress,
        incentivesController: chefIncentivesControllerAddress,
        allocPoint: allocPoint,
        underlyingAssetName: symbol,
        aTokenName: `Radiant interest bearing ${symbol}`,
        aTokenSymbol: `r${symbol}`,
        variableDebtTokenName: `Radiant variable debt bearing ${symbol}`,
        variableDebtTokenSymbol: `variableDebt${symbol}`,
        stableDebtTokenName: `Radiant stable debt bearing ${symbol}`,
        stableDebtTokenSymbol: `stableDebt${symbol}`,
        params: "0x10",
      };

      const configuration = {
        asset: reserveAssetAddress,
        ltv: ltv,
        liquidationThreshold: liquidationThreshold,
        liquidationBonus: liquidationBonus,
        stableBorrowingEnabled: false,
        reserveFactor: reserveFactor,
      };

      const ATokenFactory = await hre.ethers.getContractFactory("AToken");
      const aToken = await ATokenFactory.deploy();
      await aToken.deployed();

      const LendingPoolAddressesProviderFactory =
        await hre.ethers.getContractFactory("LendingPoolAddressesProvider");
      const lendingPoolAddressesProvider =
        LendingPoolAddressesProviderFactory.attach(
          lendingPoolAddressesProviderAddress
        );

      const lendingPoolAddress =
        await lendingPoolAddressesProvider.getLendingPool();

      const StableDebtTokenFactory = await hre.ethers.getContractFactory(
        "StableDebtToken"
      );
      const stableDebt = await StableDebtTokenFactory.deploy();
      await stableDebt.deployed();
      await (
        await stableDebt.initialize(
          lendingPoolAddress,
          reserveAssetAddress,
          chefIncentivesControllerAddress,
          init.underlyingAssetDecimals,
          init.stableDebtTokenName,
          init.stableDebtTokenSymbol,
          init.params
        )
      ).wait();

      const VariableDebtTokenFactory = await hre.ethers.getContractFactory(
        "VariableDebtToken"
      );
      const variableDebt = await VariableDebtTokenFactory.deploy();
      await variableDebt.deployed();
      await (
        await variableDebt.initialize(
          lendingPoolAddress,
          reserveAssetAddress,
          chefIncentivesControllerAddress,
          init.underlyingAssetDecimals,
          init.variableDebtTokenName,
          init.variableDebtTokenSymbol,
          init.params
        )
      ).wait();

      const DefaultReserveInterestRateStrategyFactory =
        await hre.ethers.getContractFactory(
          "DefaultReserveInterestRateStrategy"
        );
      const rates = await DefaultReserveInterestRateStrategyFactory.deploy(
        lendingPoolAddressesProviderAddress,
        "900000000000000000000000000",
        "0",
        "40000000000000000000000000",
        "600000000000000000000000000",
        "20000000000000000000000000",
        "600000000000000000000000000"
      );
      await rates.deployed();

      const lendingPoolConfiguratorProxyAddress =
        await lendingPoolAddressesProvider.getLendingPoolConfigurator();

      const LendingPoolConfiguratorFactory =
        await hre.ethers.getContractFactory("LendingPoolConfigurator");
      const lendingPoolConfigurator = LendingPoolConfiguratorFactory.attach(
        lendingPoolConfiguratorProxyAddress
      );

      init.aTokenImpl = aToken.address;
      init.stableDebtTokenImpl = stableDebt.address;
      init.variableDebtTokenImpl = variableDebt.address;
      init.interestRateStrategyAddress = rates.address;

      await lendingPoolConfigurator.batchInitReserve([init]);

      await lendingPoolConfigurator.configureReserveAsCollateral(
        configuration.asset,
        configuration.ltv,
        configuration.liquidationThreshold,
        configuration.liquidationBonus
      );
      await lendingPoolConfigurator.enableBorrowingOnReserve(
        configuration.asset,
        configuration.stableBorrowingEnabled
      );
      await lendingPoolConfigurator.setReserveFactor(
        configuration.asset,
        configuration.reserveFactor
      );

      const AaveOracleFactory = await hre.ethers.getContractFactory(
        "AaveOracle"
      );
      const aaveOracle = AaveOracleFactory.attach(
        await lendingPoolAddressesProvider.getPriceOracle()
      );
      await aaveOracle.setAssetSources(
        [reserveAssetAddress],
        [chainlinkAggregator]
      );

      console.log(`
      Asset ${symbol}: ${reserveAssetAddress}
      New interest bearing asset deployed:
      Interest bearing a${symbol} address: ${aToken.address}
      Variable Debt variableDebt${symbol} address: ${variableDebt.address}
      Stable Debt stableDebt${symbol} address: ${stableDebt.address}
      Strategy Implementation for ${symbol} address: ${rates.address}
    `);
    }
  );

task("getAllReservesData", "Gets all reserves data")
  .addParam("aaveProtocolDataProviderAddress")
  .setAction(async ({ aaveProtocolDataProviderAddress }, hre) => {
    const AaveProtocolDataProviderAddress = await hre.ethers.getContractFactory(
      "AaveProtocolDataProvider"
    );
    const aaveProtocolDataProviderFactory =
      AaveProtocolDataProviderAddress.attach(aaveProtocolDataProviderAddress);

    const addrs =
      await aaveProtocolDataProviderFactory.getReserveTokensAddresses(
        "0x774382EF196781400a335AF0c4219eEd684ED713"
      );
    console.log(addrs);

    const allReservesTokens =
      await aaveProtocolDataProviderFactory.getAllReservesTokens();

    const allReservesData = await Promise.all(
      allReservesTokens.map((entry: any) =>
        aaveProtocolDataProviderFactory.getReserveData(entry.tokenAddress)
      )
    );

    const data = allReservesData.map((entry, index) => {
      return {
        symbol: allReservesTokens[index].symbol,
        tokenAddress: allReservesTokens[index].tokenAddress,
        availableLiquidity: entry.availableLiquidity.toString(),
        totalStableDebt: entry.totalStableDebt.toString(),
        totalVariableDebt: entry.totalVariableDebt.toString(),
        liquidityRate: entry.liquidityRate.toString(),
        variableBorrowRate: entry.variableBorrowRate.toString(),
        stableBorrowRate: entry.stableBorrowRate.toString(),
        averageStableBorrowRate: entry.averageStableBorrowRate.toString(),
        liquidityIndex: entry.liquidityIndex.toString(),
        variableBorrowIndex: entry.variableBorrowIndex.toString(),
        lastUpdateTimestamp: entry.lastUpdateTimestamp,
      };
    });

    console.log(data);
  });

task("cleanLocks", "Clean expired locks").setAction(async (taskArgs, hre) => {
  const { chainId } = await hre.ethers.provider.getNetwork();
  console.log("Chain Id:", chainId);
  const config = JSON.parse(
    fs.readFileSync(`./export/${chainId}-frontend.json`).toString()
  );

  const CIC = await hre.ethers.getContractAt(
    "ChefIncentivesController",
    config.chefIncentivesController
  );

  const middleFeeDistribution = await hre.ethers.getContractAt(
    "MiddleFeeDistribution",
    await CIC.rewardMinter()
  );

  const mfdAddress = await middleFeeDistribution.multiFeeDistribution();
  const lpfdAddress = await middleFeeDistribution.lpFeeDistribution();

  const MFD = await hre.ethers.getContractAt(
    "MultiFeeDistribution",
    mfdAddress
  );

  const limit = 50;

  console.log("MultiFeeDistribution...");
  const MFDlockerlist = await hre.ethers.getContractAt(
    "LockerList",
    await MFD.userlist()
  );
  let length = await MFDlockerlist.lockersCount();
  for (let i = 0; i * limit < length.toNumber(); i += 1) {
    const lockers = await MFDlockerlist.getUsers(i, limit);
    for (const locker of lockers) {
      if (locker == hre.ethers.constants.AddressZero) {
        continue;
      }
      const lockedBalances = await MFD.lockedBalances(locker);
      if (lockedBalances.unlockable.gt(0)) {
        const receipt = await MFD.withdrawExpiredLocksFor(locker);
        await receipt.wait();
        console.log("Withdrawn expire locks for:", locker);
      }
    }
  }

  const LPFD = await hre.ethers.getContractAt(
    "MultiFeeDistribution",
    lpfdAddress
  );

  console.log("LPFeeDistribution...");
  const LPFDlockerlist = await hre.ethers.getContractAt(
    "LockerList",
    await LPFD.userlist()
  );
  length = await LPFDlockerlist.lockersCount();
  for (let i = 0; i * limit < length.toNumber(); i += 1) {
    const lockers = await LPFDlockerlist.getUsers(i, limit);
    for (const locker of lockers) {
      if (locker == hre.ethers.constants.AddressZero) {
        continue;
      }
      const lockedBalances = await LPFD.lockedBalances(locker);
      if (lockedBalances.unlockable.gt(0)) {
        const receipt = await LPFD.withdrawExpiredLocksFor(locker);
        await receipt.wait();
        console.log("Withdrawn expire locks for:", locker);
      }
    }
  }
});

task("savePendingRewards", "Save pending rewards").setAction(
  async (taskArgs, hre) => {
    const { chainId } = await hre.ethers.provider.getNetwork();
    console.log("Chain Id:", chainId);
    const config: DeployData = JSON.parse(
      fs.readFileSync(`./export/${chainId}-frontend.json`).toString()
    );

    const CIC = await hre.ethers.getContractAt(
      "ChefIncentivesController",
      config.chefIncentivesController
    );

    const MFD = await hre.ethers.getContractAt(
      "MultiFeeDistribution",
      config.multiFeeDistribution
    );
    const LPFD = await hre.ethers.getContractAt(
      "MultiFeeDistribution",
      config.lpFeeDistribution
    );

    let lockers: string[] = [];
    const limit = 50;
    console.log("Reading Lockers...");

    const MFDlockerlist = await hre.ethers.getContractAt(
      "LockerList",
      await MFD.userlist()
    );
    let length = await MFDlockerlist.lockersCount();
    for (let i = 0; i * limit < length.toNumber(); i += 1) {
      const newLockers = await MFDlockerlist.getUsers(i, limit);
      lockers.push(...newLockers);
    }

    const LPFDlockerlist = await hre.ethers.getContractAt(
      "LockerList",
      await LPFD.userlist()
    );
    length = await LPFDlockerlist.lockersCount();
    for (let i = 0; i * limit < length.toNumber(); i += 1) {
      const newLockers = await LPFDlockerlist.getUsers(i, limit);
      lockers.push(...newLockers);
    }

    lockers = lockers.filter(
      (user, index) =>
        lockers.indexOf(user) === index &&
        user !== hre.ethers.constants.AddressZero
    );

    const pack = 10;
    for (let i = 0; i < lockers.length; i += pack) {
      const users = lockers.slice(i, i + pack);
      const receipt = await CIC.saveUserRewards(users);
      await receipt.wait();
      console.log("Saved rewards for:", ...users);
    }
  }
);

task("withdrawLP", "Withdraw LP from MFD")
  .addParam("timestamp")
  .setAction(async (taskArgs, hre) => {
    const { chainId } = await hre.ethers.provider.getNetwork();
    console.log("Chain Id:", chainId);
    const config: DeployData = JSON.parse(
      fs.readFileSync(`./export/${chainId}-frontend.json`).toString()
    );

    const LPFD = await hre.ethers.getContractAt(
      "MultiFeeDistribution",
      config.lpFeeDistribution
    );

    let lockers: string[] = [];
    const limit = 50;
    console.log("Reading Lockers...");

    const LPFDlockerlist = await hre.ethers.getContractAt(
      "LockerList",
      await LPFD.userlist()
    );
    const length = await LPFDlockerlist.lockersCount();
    for (let i = 0; i * limit < length.toNumber(); i += 1) {
      const newLockers = await LPFDlockerlist.getUsers(i, limit);
      lockers.push(...newLockers);
    }

    lockers = lockers.filter(
      (user, index) =>
        lockers.indexOf(user) === index &&
        user !== hre.ethers.constants.AddressZero
    );

    let withdrawable = hre.ethers.BigNumber.from(0);
    for (const locker of lockers) {
      const locks = await LPFD.lockInfo(locker);
      for (const lock of locks) {
        if (lock.unlockTime.gt(taskArgs.timestamp)) {
          withdrawable = withdrawable.add(lock.amount);
        }
      }
    }

    if (withdrawable.gt(0)) {
      const receipt = await LPFD.recoverERC20(
        await LPFD.stakingToken(),
        withdrawable
      );
      await receipt.wait();
    }
    console.log("Withdrawn", hre.ethers.utils.formatUnits(withdrawable, 18));
  });
