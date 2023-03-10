
import { ethers } from "ethers";
import { DeployConfig, LP_PROVIDER } from "../scripts/deploy/types";
import { getInitLpAmts } from "../scripts/deploy/helpers/getInitLpAmts";
import BaseConfig from "./BaseConfig";
import { DAY } from "./constants";

const VEST_TIME: number = 30 * DAY;

const LP_PLATFORM = LP_PROVIDER.UNISWAP;
const LP_INIT_ETH = 200;
export const targetPrice = .12;
export const ethPrice = 1600;
const LP_INIT_RDNT = getInitLpAmts(LP_PLATFORM, LP_INIT_ETH, ethPrice, targetPrice);

const chainConfig = {
  "NETWORK": "hardhat",
  "CHAIN_ID": 31337,
  "TESTNET": true,
  "DEPLOY_WETH": true,
  "DEPLOY_DELAY": 0,

  "MINT_AMT": ethers.utils.parseUnits("100000000", 18),

  "MFD_VEST_DURATION": VEST_TIME,

  "SUPPLY_MAX": ethers.utils.parseUnits("100000000", 18),
  "SUPPLY_MAX_MINT": ethers.utils.parseUnits("100000000", 18),
  "SUPPLY_LP_MINT": ethers.utils.parseUnits("1000000", 18),
  "SUPPLY_TEAM_MINT": ethers.utils.parseUnits("1000000", 18),
  "SUPPLY_TEAM_VEST": ethers.utils.parseUnits("1000000", 18),
  "SUPPLY_ECO_MINT": ethers.utils.parseUnits("10000000", 18),
  "SUPPLY_CIC_RESERVE": ethers.utils.parseUnits("20000000", 18),
  "SUPPLY_MIGRATION_MINT": ethers.utils.parseUnits("10000000", 18),
  "SUPPLY_DQ_RESERVE": ethers.utils.parseUnits("100000", 18),

  "LP_PROVIDER": LP_PLATFORM,
  "LP_INIT_ETH": ethers.utils.parseUnits(LP_INIT_ETH.toString(), 18),
  "LP_INIT_RDNT": ethers.utils.parseUnits(LP_INIT_RDNT.toString(), 18),

  "CIC_RPS": ethers.utils.parseUnits(".1", 18),

  "DQ_TARGET_BASE_BOUNTY_USD": ethers.utils.parseUnits("5", 18),
  "DQ_BOOSTER": ethers.utils.parseUnits("0", 18),
  "DQ_MAX_BASE_BOUNTY": ethers.utils.parseUnits("100", 18),

  "RADIANT_V1": "0x0000000000000000000000000000000000000000",

  "DAO": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "EMISSIONS_RESERVE": "0xB00bDAb497D25861163b7F1b279B809bCCfc2d46",
  "TREASURY": "0xB00bDAb497D25861163b7F1b279B809bCCfc2d46",
  "STARFLEET_TREASURY": "0xB00bDAb497D25861163b7F1b279B809bCCfc2d46",
  "TEAM_RECEIVER": "0xB00bDAb497D25861163b7F1b279B809bCCfc2d46",
  "LP_RECEIVER": "0xB00bDAb497D25861163b7F1b279B809bCCfc2d46",
  "ECOSYSTEM_RECEIVER": "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
  "TIMELOCK_ADMIN": "0x2E0d70682eF0780e6D66cfCe6cEFc3A7d2e8C371",
  "EMERGENCY_ADMIN": "0x6bF960b98BB0a592260871485f00415B0c5DcB5a",

  "WETH_ADDRESS": "0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6",
  "ROUTER_ADDR": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  "BAL_WEIGHTED_POOL_FACTORY": "0x8E9aa87E45e92bad84D5F8DD1bff34Fb92637dE9",
  "BAL_VAULT": "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
  "BAL_WSTETH_POOL": "",
  "STARGATE_ROUTER": "0xb850873f4c993Ac2405A1AdD71F6ca5D4d4d6b4f",
  "STARGATE_ROUTER_ETH": "0x7612aE2a34E5A363E137De748801FB4c86499152",
  "LZ_ENDPOINT": "0x6aB5Ae6822647046626e83ee6dB8187151E1d5ab",
  "CHAINLINK_AGGREGATOR_PROXY": "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e",
  "CHAINLINK_ETH_USD_AGGREGATOR_PROXY": "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e",

  "TOKENS_CONFIG": [
    [
      "USDC",
      {
        "assetAddress": "0xCb2A18E5328Daf9eeF62C6D2DF415a27D7118b23",
        "chainlinkAggregator": "0xAb5c49580294Aff77670F839ea425f5b78ab3Ae7",
        "borrowRate": "39000000000000000000000000",
        "reservesParams": {
          "aTokenImpl": "AToken",
          "baseLTVAsCollateral": "8000",
          "borrowingEnabled": true,
          "liquidationBonus": "11500",
          "liquidationThreshold": "8500",
          "reserveDecimals": "6",
          "reserveFactor": BaseConfig.RESERVE_FACTOR,
          "stableBorrowRateEnabled": false,
          "strategy": {
            "baseVariableBorrowRate": "0",
            "name": "rateStrategyStableThree",
            "optimalUtilizationRate": "900000000000000000000000000",
            "variableRateSlope1": "40000000000000000000000000",
            "variableRateSlope2": "600000000000000000000000000",
            "stableRateSlope1": "20000000000000000000000000",
            "stableRateSlope2": "600000000000000000000000000"
          }
        },
        "initInputParams": {
          "aTokenImpl": "0x0000000000000000000000000000000000000000",
          "aTokenName": "Radiant interest bearing USDC",
          "aTokenSymbol": "rUSDC",
          "incentivesController": "0x0000000000000000000000000000000000000000",
          "interestRateStrategyAddress":
            "0x0000000000000000000000000000000000000000",
          "params": "0x10",
          "stableDebtTokenImpl": "0x0000000000000000000000000000000000000000",
          "stableDebtTokenName": "Radiant stable debt bearing USDC",
          "stableDebtTokenSymbol": "stableDebtUSDC",
          "treasury": "0x0000000000000000000000000000000000000000",
          "underlyingAsset": "0xCb2A18E5328Daf9eeF62C6D2DF415a27D7118b23",
          "underlyingAssetDecimals": "6",
          "underlyingAssetName": "USDC",
          "variableDebtTokenImpl": "0x0000000000000000000000000000000000000000",
          "variableDebtTokenName": "Radiant variable debt bearing USDC",
          "variableDebtTokenSymbol": "variableDebtUSDC",
          "allocPoint": 100
        }
      }
    ],
    [
      "USDT",
      {
        "assetAddress": "0xa43A5FD4a2ce19B5fFcf00065FcC877392C326bf",
        "chainlinkAggregator": "0xAb5c49580294Aff77670F839ea425f5b78ab3Ae7",
        "borrowRate": "39000000000000000000000000",
        "reservesParams": {
          "aTokenImpl": "AToken",
          "baseLTVAsCollateral": "8000",
          "borrowingEnabled": true,
          "liquidationBonus": "11500",
          "liquidationThreshold": "8500",
          "reserveDecimals": "6",
          "reserveFactor": BaseConfig.RESERVE_FACTOR,
          "stableBorrowRateEnabled": false,
          "strategy": {
            "baseVariableBorrowRate": "0",
            "name": "rateStrategyStableThree",
            "optimalUtilizationRate": "900000000000000000000000000",
            "variableRateSlope1": "40000000000000000000000000",
            "variableRateSlope2": "600000000000000000000000000",
            "stableRateSlope1": "20000000000000000000000000",
            "stableRateSlope2": "600000000000000000000000000"
          }
        },
        "initInputParams": {
          "aTokenImpl": "0x0000000000000000000000000000000000000000",
          "aTokenName": "Radiant interest bearing USDT",
          "aTokenSymbol": "rUSDT",
          "incentivesController": "0x0000000000000000000000000000000000000000",
          "interestRateStrategyAddress":
            "0x0000000000000000000000000000000000000000",
          "params": "0x10",
          "stableDebtTokenImpl": "0x0000000000000000000000000000000000000000",
          "stableDebtTokenName": "Radiant stable debt bearing USDT",
          "stableDebtTokenSymbol": "stableDebtUSDT",
          "treasury": "0x0000000000000000000000000000000000000000",
          "underlyingAsset": "0xa43A5FD4a2ce19B5fFcf00065FcC877392C326bf",
          "underlyingAssetDecimals": "6",
          "underlyingAssetName": "USDT",
          "variableDebtTokenImpl": "0x0000000000000000000000000000000000000000",
          "variableDebtTokenName": "Radiant variable debt bearing USDT",
          "variableDebtTokenSymbol": "variableDebtUSDT",
          "allocPoint": 100
        }
      }
    ],
    [
      "DAI",
      {
        "assetAddress": "0x479df35c7EDa9AE8B2086F54b6c42115D8a971D9",
        "chainlinkAggregator": "0x0d79df66BE487753B02D015Fb622DED7f0E9798d",
        "borrowRate": "39000000000000000000000000",
        "reservesParams": {
          "aTokenImpl": "AToken",
          "baseLTVAsCollateral": "7500",
          "borrowingEnabled": true,
          "liquidationBonus": "11500",
          "liquidationThreshold": "8500",
          "reserveDecimals": "18",
          "reserveFactor": BaseConfig.RESERVE_FACTOR,
          "stableBorrowRateEnabled": false,
          "strategy": {
            "baseVariableBorrowRate": "0",
            "name": "rateStrategyStableTwo",
            "optimalUtilizationRate": "800000000000000000000000000",
            "variableRateSlope1": "40000000000000000000000000",
            "variableRateSlope2": "750000000000000000000000000",
            "stableRateSlope1": "20000000000000000000000000",
            "stableRateSlope2": "750000000000000000000000000"
          }
        },
        "initInputParams": {
          "aTokenImpl": "0x0000000000000000000000000000000000000000",
          "aTokenName": "Radiant interest bearing DAI",
          "aTokenSymbol": "rDAI",
          "incentivesController": "0x0000000000000000000000000000000000000000",
          "interestRateStrategyAddress":
            "0x0000000000000000000000000000000000000000",
          "params": "0x10",
          "stableDebtTokenImpl": "0x0000000000000000000000000000000000000000",
          "stableDebtTokenName": "Radiant stable debt bearing DAI",
          "stableDebtTokenSymbol": "stableDebtDAI",
          "treasury": "0x0000000000000000000000000000000000000000",
          "underlyingAsset": "0x479df35c7EDa9AE8B2086F54b6c42115D8a971D9",
          "underlyingAssetDecimals": "18",
          "underlyingAssetName": "DAI",
          "variableDebtTokenImpl": "0x0000000000000000000000000000000000000000",
          "variableDebtTokenName": "Radiant variable debt bearing DAI",
          "variableDebtTokenSymbol": "variableDebtDAI",
          "allocPoint": 100
        }
      }
    ],
    [
      "WBTC",
      {
        "assetAddress": "0x22f8aD679830CEDE98c53f63Ae060A58D001BF94",
        "chainlinkAggregator": "0xA39434A63A52E749F02807ae27335515BA4b07F7",
        "borrowRate": "30000000000000000000000000",
        "reservesParams": {
          "aTokenImpl": "AToken",
          "baseLTVAsCollateral": "7000",
          "borrowingEnabled": true,
          "liquidationBonus": "11500",
          "liquidationThreshold": "7500",
          "reserveDecimals": "8",
          "reserveFactor": BaseConfig.RESERVE_FACTOR,
          "stableBorrowRateEnabled": false,
          "strategy": {
            "baseVariableBorrowRate": "0",
            "name": "rateStrategyVolatileTwo",
            "optimalUtilizationRate": "650000000000000000000000000",
            "variableRateSlope1": "80000000000000000000000000",
            "variableRateSlope2": "3000000000000000000000000000",
            "stableRateSlope1": "100000000000000000000000000",
            "stableRateSlope2": "3000000000000000000000000000"
          }
        },
        "initInputParams": {
          "aTokenImpl": "0x0000000000000000000000000000000000000000",
          "aTokenName": "Radiant interest bearing WBTC",
          "aTokenSymbol": "rWBTC",
          "incentivesController": "0x0000000000000000000000000000000000000000",
          "interestRateStrategyAddress":
            "0x0000000000000000000000000000000000000000",
          "params": "0x10",
          "stableDebtTokenImpl": "0x0000000000000000000000000000000000000000",
          "stableDebtTokenName": "Radiant stable debt bearing WBTC",
          "stableDebtTokenSymbol": "stableDebtWBTC",
          "treasury": "0x0000000000000000000000000000000000000000",
          "underlyingAsset": "0x22f8aD679830CEDE98c53f63Ae060A58D001BF94",
          "underlyingAssetDecimals": "8",
          "underlyingAssetName": "WBTC",
          "variableDebtTokenImpl": "0x0000000000000000000000000000000000000000",
          "variableDebtTokenName": "Radiant variable debt bearing WBTC",
          "variableDebtTokenSymbol": "variableDebtWBTC",
          "allocPoint": 100
        }
      }
    ],
    [
      "WETH",
      {
        "assetAddress": "0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6",
        "chainlinkAggregator": "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e",
        "borrowRate": "30000000000000000000000000",
        "reservesParams": {
          "aTokenImpl": "AToken",
          "baseLTVAsCollateral": "8000",
          "borrowingEnabled": true,
          "liquidationBonus": "11500",
          "liquidationThreshold": "8250",
          "reserveDecimals": "18",
          "reserveFactor": BaseConfig.RESERVE_FACTOR,
          "stableBorrowRateEnabled": false,
          "strategy": {
            "baseVariableBorrowRate": "0",
            "name": "rateStrategyWETH",
            "optimalUtilizationRate": "650000000000000000000000000",
            "variableRateSlope1": "80000000000000000000000000",
            "variableRateSlope2": "1000000000000000000000000000",
            "stableRateSlope1": "100000000000000000000000000",
            "stableRateSlope2": "1000000000000000000000000000"
          }
        },
        "initInputParams": {
          "aTokenImpl": "0x0000000000000000000000000000000000000000",
          "aTokenName": "Radiant interest bearing WETH",
          "aTokenSymbol": "rWETH",
          "incentivesController": "0x0000000000000000000000000000000000000000",
          "interestRateStrategyAddress":
            "0x0000000000000000000000000000000000000000",
          "params": "0x10",
          "stableDebtTokenImpl": "0x0000000000000000000000000000000000000000",
          "stableDebtTokenName": "Radiant stable debt bearing WETH",
          "stableDebtTokenSymbol": "stableDebtWETH",
          "treasury": "0x0000000000000000000000000000000000000000",
          "underlyingAsset": "0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6",
          "underlyingAssetDecimals": "18",
          "underlyingAssetName": "WETH",
          "variableDebtTokenImpl": "0x0000000000000000000000000000000000000000",
          "variableDebtTokenName": "Radiant variable debt bearing WETH",
          "variableDebtTokenSymbol": "variableDebtWETH",
          "allocPoint": 100
        }
      }
    ],
    [
      "GLP",
      {
        "assetAddress": "0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6",
        "chainlinkAggregator": "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e",
        "borrowRate": "30000000000000000000000000",
        "reservesParams": {
          "aTokenImpl": "AToken",
          "baseLTVAsCollateral": "8000",
          "borrowingEnabled": true,
          "liquidationBonus": "11500",
          "liquidationThreshold": "8250",
          "reserveDecimals": "18",
          "reserveFactor": BaseConfig.RESERVE_FACTOR,
          "stableBorrowRateEnabled": false,
          "strategy": {
            "baseVariableBorrowRate": "0",
            "name": "rateStrategyWETH",
            "optimalUtilizationRate": "650000000000000000000000000",
            "variableRateSlope1": "80000000000000000000000000",
            "variableRateSlope2": "1000000000000000000000000000",
            "stableRateSlope1": "100000000000000000000000000",
            "stableRateSlope2": "1000000000000000000000000000"
          }
        },
        "initInputParams": {
          "aTokenImpl": "0x0000000000000000000000000000000000000000",
          "aTokenName": "Radiant interest bearing GLP",
          "aTokenSymbol": "rGLP",
          "incentivesController": "0x0000000000000000000000000000000000000000",
          "interestRateStrategyAddress":
            "0x0000000000000000000000000000000000000000",
          "params": "0x10",
          "stableDebtTokenImpl": "0x0000000000000000000000000000000000000000",
          "stableDebtTokenName": "Radiant stable debt bearing GLP",
          "stableDebtTokenSymbol": "stableDebtGLP",
          "treasury": "0x0000000000000000000000000000000000000000",
          "underlyingAsset": "0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6",
          "underlyingAssetDecimals": "18",
          "underlyingAssetName": "GLP",
          "variableDebtTokenImpl": "0x0000000000000000000000000000000000000000",
          "variableDebtTokenName": "Radiant variable debt bearing GLP",
          "variableDebtTokenSymbol": "variableDebtGLP",
          "allocPoint": 100
        }
      }
    ],
    [
      "FRAX",
      {
        "assetAddress": "0x479df35c7EDa9AE8B2086F54b6c42115D8a971D9",
        "chainlinkAggregator": "0x0d79df66BE487753B02D015Fb622DED7f0E9798d",
        "borrowRate": "39000000000000000000000000",
        "reservesParams": {
          "aTokenImpl": "AToken",
          "baseLTVAsCollateral": "7500",
          "borrowingEnabled": true,
          "liquidationBonus": "11500",
          "liquidationThreshold": "8500",
          "reserveDecimals": "18",
          "reserveFactor": BaseConfig.RESERVE_FACTOR,
          "stableBorrowRateEnabled": false,
          "strategy": {
            "baseVariableBorrowRate": "0",
            "name": "rateStrategyStableTwo",
            "optimalUtilizationRate": "800000000000000000000000000",
            "variableRateSlope1": "40000000000000000000000000",
            "variableRateSlope2": "750000000000000000000000000",
            "stableRateSlope1": "20000000000000000000000000",
            "stableRateSlope2": "750000000000000000000000000"
          }
        },
        "initInputParams": {
          "aTokenImpl": "0x0000000000000000000000000000000000000000",
          "aTokenName": "Radiant interest bearing FRAX",
          "aTokenSymbol": "rFRAX",
          "incentivesController": "0x0000000000000000000000000000000000000000",
          "interestRateStrategyAddress":
            "0x0000000000000000000000000000000000000000",
          "params": "0x10",
          "stableDebtTokenImpl": "0x0000000000000000000000000000000000000000",
          "stableDebtTokenName": "Radiant stable debt bearing FRAX",
          "stableDebtTokenSymbol": "stableDebtFRAX",
          "treasury": "0x0000000000000000000000000000000000000000",
          "underlyingAsset": "0x479df35c7EDa9AE8B2086F54b6c42115D8a971D9",
          "underlyingAssetDecimals": "18",
          "underlyingAssetName": "FRAX",
          "variableDebtTokenImpl": "0x0000000000000000000000000000000000000000",
          "variableDebtTokenName": "Radiant variable debt bearing FRAX",
          "variableDebtTokenSymbol": "variableDebtFRAX",
          "allocPoint": 100
        }
      }
    ]
  ],
  "STARGATE_CONFIG": {
    "ASSETS": ["0xCb2A18E5328Daf9eeF62C6D2DF415a27D7118b23", "0xa43A5FD4a2ce19B5fFcf00065FcC877392C326bf", "0x479df35c7EDa9AE8B2086F54b6c42115D8a971D9"],
    "POOL_IDS": [1, 2, 3]
  }
}

const HardhatDeployConfig: DeployConfig = { ...BaseConfig, ...chainConfig };
export default HardhatDeployConfig;