import {Contract} from 'ethers';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {getConfigForChain} from '../config';

let wethAbi = [
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: 'src',
				type: 'address',
			},
			{
				indexed: true,
				internalType: 'address',
				name: 'guy',
				type: 'address',
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: 'wad',
				type: 'uint256',
			},
		],
		name: 'Approval',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: 'dst',
				type: 'address',
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: 'wad',
				type: 'uint256',
			},
		],
		name: 'Deposit',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: 'src',
				type: 'address',
			},
			{
				indexed: true,
				internalType: 'address',
				name: 'dst',
				type: 'address',
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: 'wad',
				type: 'uint256',
			},
		],
		name: 'Transfer',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: 'src',
				type: 'address',
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: 'wad',
				type: 'uint256',
			},
		],
		name: 'Withdrawal',
		type: 'event',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
		],
		name: 'allowance',
		outputs: [
			{
				internalType: 'uint256',
				name: '',
				type: 'uint256',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'guy',
				type: 'address',
			},
			{
				internalType: 'uint256',
				name: 'wad',
				type: 'uint256',
			},
		],
		name: 'approve',
		outputs: [
			{
				internalType: 'bool',
				name: '',
				type: 'bool',
			},
		],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
		],
		name: 'balanceOf',
		outputs: [
			{
				internalType: 'uint256',
				name: '',
				type: 'uint256',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'decimals',
		outputs: [
			{
				internalType: 'uint8',
				name: '',
				type: 'uint8',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'deposit',
		outputs: [],
		stateMutability: 'payable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'uint256',
				name: 'val',
				type: 'uint256',
			},
		],
		name: 'mint',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [],
		name: 'name',
		outputs: [
			{
				internalType: 'string',
				name: '',
				type: 'string',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'symbol',
		outputs: [
			{
				internalType: 'string',
				name: '',
				type: 'string',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'totalSupply',
		outputs: [
			{
				internalType: 'uint256',
				name: '',
				type: 'uint256',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'dst',
				type: 'address',
			},
			{
				internalType: 'uint256',
				name: 'wad',
				type: 'uint256',
			},
		],
		name: 'transfer',
		outputs: [
			{
				internalType: 'bool',
				name: '',
				type: 'bool',
			},
		],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'src',
				type: 'address',
			},
			{
				internalType: 'address',
				name: 'dst',
				type: 'address',
			},
			{
				internalType: 'uint256',
				name: 'wad',
				type: 'uint256',
			},
		],
		name: 'transferFrom',
		outputs: [
			{
				internalType: 'bool',
				name: '',
				type: 'bool',
			},
		],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'uint256',
				name: 'wad',
				type: 'uint256',
			},
		],
		name: 'withdraw',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
];

const getWeth = async (
	hre: HardhatRuntimeEnvironment
): Promise<{
	weth: Contract;
	chainlinkEthUsd: string;
}> => {
	const {config} = getConfigForChain(await hre.getChainId());
	let chainlinkEthUsd = config.CHAINLINK_ETH_USD_AGGREGATOR_PROXY;
	let baseAssetWrapped = config.CHAIN_ID == 97 || config.CHAIN_ID == 56 ? 'WBNB' : 'WETH';
	let weth;

	if (hre.network.tags.mocks) {
		weth = <Contract>await hre.ethers.getContract(baseAssetWrapped);
		chainlinkEthUsd = (await hre.ethers.getContract(`${baseAssetWrapped}Aggregator`)).address;
	} else {
		console.log(`Looking up ${baseAssetWrapped}: ${config['WETH']}`);
		weth = <Contract>await hre.ethers.getContractAt(wethAbi, config['WETH']);
	}
	return {
		weth,
		chainlinkEthUsd,
	};
};

const wait = async (secs: number) => {
	return new Promise((res, rej) => {
		setTimeout(res, secs * 1000);
	});
};
export {getWeth, wait};
