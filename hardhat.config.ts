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
// import "@nomiclabs/hardhat-etherscan";

import {generateCompilerOverrides} from './utils/compilerOverrides';

const config: HardhatUserConfig = {
	namedAccounts: {
		deployer: {
			default: 0,
			56: '0x225c6084086F83eCe4BC747403f292a7d324Fd2E',
			42161: '0x7759124915160E94C77EcE5B96E8a7fCec44Aa19',
		},
		dao: {
			default: 1,
			56: '0x23a06b7644405bE380ACC1be0Ff54eeBeEC69aEd',
			42161: '0x750129c21c7846CFE0ce2c966D84c0bcA5658497',
		},
		treasury: {
			default: 2,
			56: '0x769549Ab2765f2541FF6d5b6655B8bD36f99705E',
			42161: '0x769549Ab2765f2541FF6d5b6655B8bD36f99705E',
		},
		admin: {
			default: 0,
			56: '0xE4714D6BD9a6c0F6194C1aa8602850b0a1cE1416',
			42161: '0x111CEEee040739fD91D29C34C33E6B3E112F2177',
		},
		vestManager: {
			default: 4,
			56: '0xA90a20698ff30486A14B685eCdC0d86269C404EB',
			42161: '0x1BAABe1e4128E76EdB1FF76EE528864e4772C17d',
		},
	},
	solidity: {
		compilers: [
			{
				version: '0.8.12',
				settings: {
					optimizer: {
						enabled: true,
						runs: 1000,
						details: {
							yul: true,
						},
					},
				},
			},
		],
		overrides: generateCompilerOverrides(),
	},
	networks: {
		hardhat: {
			loggingEnabled: true,
			initialBaseFeePerGas: 0,
			allowUnlimitedContractSize: false,
			gasPrice: 0,
			autoImpersonate: true,
			blockGasLimit: 30000000000000,
			// forking: {
			// url: 'https://black-autumn-bush.arbitrum-mainnet.quiknode.pro/378c9248c6a64af89c198dff184e09664f56f7c7/',
			// blockNumber: 76739035,
			// },
			// chainId: 42161,
			chainId: 56,
			forking: {
				url: 'https://rpc-bsc.radiant.capital/e2af014b7281333ef80331dd368694e6b2e5c738/',
				// blockNumber: 26829124,
			},
			tags: ['mocks', 'testing'],
		},
		localhost: {
			url: node_url('localhost'),
			autoImpersonate: true,
			// accounts: accounts(),
			chainId: 56,
			timeout: 10000000000000,
			// accounts: [process.env.PRIVATE_KEY_BSC || ''],
			tags: ['mocks', 'testing'],
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
			tags: ['mocks', 'testing'],
		},
		bsc: {
			// url: 'https://rpc-bsc.radiant.capital/e2af014b7281333ef80331dd368694e6b2e5c738/',
			url: 'https://bsc-dataseed2.binance.org',
			accounts: [process.env.PRIVATE_KEY_BSC || ''],
			chainId: 56,
		},
		arbitrum: {
			url: 'https://black-autumn-bush.arbitrum-mainnet.quiknode.pro/378c9248c6a64af89c198dff184e09664f56f7c7/',
			// url: 'https://rpc.tenderly.co/fork/f06a140f-3038-4be8-a341-b85e24c1910f',
			accounts: [process.env.PRIVATE_KEY_ARBITRUM || ''],
			chainId: 42161,
			verify: {
				etherscan: {
					apiKey: 'DNDKPM829V5AQD7KQT34DRRIJDA8CYQNY6',
					apiUrl: 'https://api.arbiscan.io/',
				},
			},
			// tags: ['oracle_v3'],
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
	etherscan: {
		apiKey: {
			arbitrum: 'DNDKPM829V5AQD7KQT34DRRIJDA8CYQNY6',
		},
	},
	mocha: {
		timeout: 1000000,
		bail: true,
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
		project: 'arbi-v2',
		username: 'radiant',
	},
	defender: {
		apiKey: process.env.DEFENDER_API_KEY || 'p1aTYF2ANvWWV7PEKcUKmQyZUvSxY8j8',
		apiSecret:
			process.env.DEFENDER_API_SECRET || '2HKUvsu7Ak23WfdPMmbMUcMnAYGnTouuzG29nCBUzkHCFPBe4UeM28jw5mhiwPCP',
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
