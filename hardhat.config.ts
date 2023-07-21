import 'dotenv/config';
import {HardhatUserConfig} from 'hardhat/types';
import 'hardhat-deploy';
import '@nomiclabs/hardhat-ethers';
import 'hardhat-deploy-ethers';
import 'hardhat-gas-reporter';
import '@typechain/hardhat';
import 'solidity-coverage';
import 'hardhat-contract-sizer';
import {node_url, accounts, addForkConfiguration} from './utils/network';
import '@openzeppelin/hardhat-upgrades';
import '@openzeppelin/hardhat-defender';
import 'hardhat-deploy-tenderly';
import './tasks';
import '@nomiclabs/hardhat-web3';
import {generateCompilerOverrides} from './utils/compilerOverrides';

const config: HardhatUserConfig = {
	namedAccounts: {
		deployer: {
			default: 0,
		},
		dao: {
			default: 1,
		},
		treasury: {
			default: 2,
		},
		admin: {
			default: 3,
		},
		vestManager: {
			default: 4,
		},
		starfleet: {
			default: 5,
		},
	},
	networks: {
		hardhat: {
			initialBaseFeePerGas: 0,
			allowUnlimitedContractSize: false,
			gasPrice: 0,
			autoImpersonate: true,
			blockGasLimit: 30000000000000,
			// Had to comment this out to get The Graph to almost work, but I think it is necessary
			// forking: {
			// 	url: node_url('arbitrum'),
			// 	blockNumber: 81749742,
			// },
			tags: ['mocks', 'testing', 'oracle_v2', 'post_assets'],
		},
		localhost: {
			url: node_url('localhost'),
			autoImpersonate: true,
			accounts: accounts(),
			timeout: 10000000000000,
			tags: ['mocks', 'testing', 'oracle_v2', 'post_assets'],
		},
		arbitrum_goerli: {
			url: node_url('arbitrum_goerli'),
			accounts: [process.env.PRIVATE_KEY_ARBI_GOERLI || ''],
			chainId: 421613,
		},
		bsc_testnet: {
			url: node_url('bsc_testnet'),
			accounts: [process.env.PRIVATE_KEY_BSC_TESTNET || ''],
			chainId: 97,
			tags: ['mocks', 'testing', 'oracle_v2', 'post_assets'],
		},
		bsc: {
			url: node_url('bsc'),
			accounts: [process.env.PRIVATE_KEY_BSC || ''],
			chainId: 56,
		},
		arbitrum: {
			url: node_url('arbitrum'),
			accounts: [process.env.PRIVATE_KEY_ARBITRUM || ''],
			chainId: 42161,
			verify: {
				etherscan: {
					apiKey: process.env.ETHERSCAN_API_KEY || '',
					apiUrl: 'https://api.arbiscan.io/',
				},
			},
			tags: ['post_assets', 'oracle_cl'],
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
			accounts: [process.env.PRIVATE_KEY_GOERLI || ''],
		},
	},
	solidity: {
		compilers: [
			{
				version: '0.8.12',
				settings: {
					optimizer: {
						enabled: true,
						runs: parseInt(process.env.OPTIMIZER_RUNS || '1000'),
						details: {
							yul: true,
						},
					},
				},
			},
		],
		overrides: generateCompilerOverrides(),
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
		timeout: 1000000,
		// bail: true,
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
		username: process.env.TENDERLY_USERNAME || '',
		project: process.env.TENDERLY_PROJECT || '',
	},
	defender: {
		apiKey: process.env.DEFENDER_API_KEY || '',
		apiSecret: process.env.DEFENDER_API_SECRET || '',
	},
};

if (process.env.IS_CI === 'true') {
	if (config && config !== undefined) {
		if (config.hasOwnProperty('mocha') && config.mocha !== undefined) {
			config.mocha.reporter = 'json';
			config.mocha.reporterOptions = {
				output: 'test-results.json',
			};
		}
	}
}

export default config;
