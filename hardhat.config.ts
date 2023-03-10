import 'dotenv/config';
import { HardhatUserConfig } from 'hardhat/types';
import 'hardhat-deploy';
import '@nomiclabs/hardhat-ethers';
import 'hardhat-deploy-ethers';
import 'hardhat-gas-reporter';
import '@typechain/hardhat';
import 'solidity-coverage';
import "hardhat-contract-sizer";
import { node_url, accounts, addForkConfiguration } from './utils/network';
import '@openzeppelin/hardhat-upgrades';
import '@openzeppelin/hardhat-defender';
import 'hardhat-deploy-tenderly';
import "./tasks"
import "@nomiclabs/hardhat-web3"

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      // {
      //   version: "0.6.6",
      // },
      {
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
            details: {
              yul: true
            }
          }
        }
      },
    ],
    overrides: {
      "contracts/uniswap/*": {
        version: "0.6.6",
      },
      // "contracts/uniswap/periphery/UniswapV2Router02.sol": {
      //   version: "0.6.6",
      // }
    }
  },
  namedAccounts: {
    deployer: {
      default: 0,
      97: "0xA3De96858FD006fd978eA2D55Efe6b125012f485",
      421613: '0xA3De96858FD006fd978eA2D55Efe6b125012f485'
    },
    dao: {
      default: 1,
      97: "0xA3De96858FD006fd978eA2D55Efe6b125012f485",
      421613: '0xA3De96858FD006fd978eA2D55Efe6b125012f485'
    },
    treasury: {
      default: 2,
      97: "0xA3De96858FD006fd978eA2D55Efe6b125012f485",
      421613: '0xA3De96858FD006fd978eA2D55Efe6b125012f485'
    },
    admin: {
      default: 0,
      97: "0xA3De96858FD006fd978eA2D55Efe6b125012f485",
      421613: '0x71810d252db23AFd9d6A9be925Da148c2F83D926'
    }
  },
  networks: {
    hardhat: {
      initialBaseFeePerGas: 0, // to fix : https://github.com/sc-forks/solidity-coverage/issues/652, see https://github.com/sc-forks/solidity-coverage/issues/652#issuecomment-896330136
      loggingEnabled: false,
      allowUnlimitedContractSize: true,
      gasPrice: 0,
      blockGasLimit: 30000000000000,
      forking: {
        url: "https://rpc.radiant.capital/70ff72eec58b50f824282a0c28f3434d585c9410/",
        blockNumber: 68350821
      },
      tags: ["core"]
    },
    localhost: {
      url: node_url('localhost'),
      // accounts: [process.env.PRIVATE_KEY_ARBI_GOERLI],
      chainId: 31337,
      accounts: accounts(),
      tags: ["core"]
      // accounts: [process.env.PRIVATE_KEY],

    },
    "arbitrum-goerli": {
      url: node_url('arbitrum_goerli'),
      accounts: [process.env.PRIVATE_KEY_ARBI_GOERLI],
      chainId: 421613,
      tags: ["core", "live"]
    },
    "bsc-testnet": {
      url: node_url('bsc_testnet'),
      accounts: [process.env.PRIVATE_KEY_BSC_TESTNET],
      chainId: 97,
      tags: ["core", "live"]
    },
    production: {
      url: node_url('mainnet'),
      accounts: accounts('mainnet'),
    },
    mainnet: {
      url: node_url('mainnet'),
      accounts: accounts('mainnet'),
    },
    rinkeby: {
      url: node_url('rinkeby'),
      accounts: accounts('rinkeby'),
    },
    kovan: {
      url: node_url('kovan'),
      accounts: accounts('kovan'),
    },
    goerli: {
      url: node_url('goerli'),
      // accounts: accounts('goerli'),
      accounts: [process.env.PRIVATE_KEY_GOERLI],
    },
  },
  paths: {
    sources: 'contracts',
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 100,
    enabled: process.env.REPORT_GAS ? true : false,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    maxMethodDiff: 10,
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
  mocha: {
    timeout: 0,
    bail: true
  },
  external: process.env.HARDHAT_FORK
    ? {
      deployments: {
        // process.env.HARDHAT_FORK will specify the network that the fork is made from.
        // these lines allow it to fetch the deployments from the network being forked from both for node and deploy task
        hardhat: ['deployments/' + process.env.HARDHAT_FORK],
        localhost: ['deployments/' + process.env.HARDHAT_FORK],
      },
    }
    : undefined,

  tenderly: {
    project: 'beta',
    username: 'radiant',
  },
  defender: {
    apiKey: process.env.API_KEY,
    apiSecret: process.env.API_SECRET,
  },
};

let excludes = [
  'contracts/test/uniswap/UniswapV2OracleLibrary.sol',
  'contracts/test/uniswap/UniswapV2Library.sol',
  'contracts/test/uniswap/UQ112x112.sol',
  'contracts/test/uniswap/SafeMath.sol',
  'contracts/test/uniswap/periphery/UniswapV2Router02.sol',
  'contracts/test/uniswap/periphery/UniswapV2Router01.sol',
  'contracts/test/uniswap/core/UniswapV2Pair.sol',
  'contracts/test/uniswap/core/UniswapV2Factory.sol',
  'contracts/test/uniswap/core/UniswapV2ERC20.sol',
  'contracts/test/uniswap/periphery/test/RouterEventEmitter.sol',
  'contracts/test/uniswap/periphery/test/DeflatingERC20.sol',
  'contracts/test/uniswap/periphery/libraries/UniswapV2LiquidityMathLibrary.sol',
  'contracts/test/uniswap/periphery/libraries/UniswapV2Library.sol',
  'contracts/test/uniswap/periphery/libraries/TransferHelper.sol',
  'contracts/test/uniswap/periphery/libraries/SafeMath.sol',
  'contracts/test/uniswap/periphery/interfaces/IWETH.sol',
  'contracts/test/uniswap/periphery/interfaces/IUniswapV2Router02.sol',
  'contracts/test/uniswap/periphery/interfaces/IUniswapV2Router01.sol',
  'contracts/test/uniswap/periphery/interfaces/IUniswapV2Migrator.sol',
  'contracts/test/uniswap/periphery/interfaces/IERC20.sol',
  'contracts/test/uniswap/core/libraries/UQ112x112.sol',
  'contracts/test/uniswap/core/libraries/SafeMath.sol',
  'contracts/test/uniswap/core/libraries/Math.sol',
  'contracts/test/uniswap/core/libraries/FullMath.sol',
  'contracts/test/uniswap/core/libraries/FixedPoint.sol',
  'contracts/test/uniswap/core/libraries/BitMath.sol',
  'contracts/test/uniswap/core/libraries/Babylonian.sol',
  'contracts/test/uniswap/core/interfaces/IUniswapV2Pair.sol',
  'contracts/test/uniswap/core/interfaces/IUniswapV2Factory.sol',
  'contracts/test/uniswap/core/interfaces/IUniswapV2ERC20.sol',
  'contracts/test/uniswap/core/interfaces/IUniswapV2Callee.sol',
  'contracts/test/uniswap/core/interfaces/IERC20.sol',
  'contracts/test/uniswap/periphery/interfaces/V1/IUniswapV1Factory.sol',
  'contracts/test/uniswap/periphery/interfaces/V1/IUniswapV1Exchange.sol',
  'contracts/test/uniswap/periphery/libraries/FullMath.sol'
]

for (const contract of excludes) {
  config.solidity.overrides[contract] = {
    version: '0.6.6'
  }
}


if (process.env.IS_CI === "true") {
  if (config && config !== undefined) {
    if (config.hasOwnProperty("mocha") && config.mocha !== undefined) {
      config.mocha.reporter = "json";
      config.mocha.reporterOptions = {
        output: "test-results.json",
      };
    }
  }
}

export default config;
