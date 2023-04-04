const {ethers} = require('ethers');
const {DefenderRelaySigner, DefenderRelayProvider} = require('defender-relay-client/lib/ethers');

let mfdAddr = '0x69335A41Bc7cc5D4B9aAa7629A969dD5408791f4';

let mfdAbi = [
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: 'address',
				name: 'previousAdmin',
				type: 'address',
			},
			{
				indexed: false,
				internalType: 'address',
				name: 'newAdmin',
				type: 'address',
			},
		],
		name: 'AdminChanged',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: 'beacon',
				type: 'address',
			},
		],
		name: 'BeaconUpgraded',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: 'implementation',
				type: 'address',
			},
		],
		name: 'Upgraded',
		type: 'event',
	},
	{
		stateMutability: 'payable',
		type: 'fallback',
	},
	{
		inputs: [],
		name: 'admin',
		outputs: [
			{
				internalType: 'address',
				name: 'admin_',
				type: 'address',
			},
		],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'newAdmin',
				type: 'address',
			},
		],
		name: 'changeAdmin',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [],
		name: 'implementation',
		outputs: [
			{
				internalType: 'address',
				name: 'implementation_',
				type: 'address',
			},
		],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'newImplementation',
				type: 'address',
			},
		],
		name: 'upgradeTo',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'newImplementation',
				type: 'address',
			},
			{
				internalType: 'bytes',
				name: 'data',
				type: 'bytes',
			},
		],
		name: 'upgradeToAndCall',
		outputs: [],
		stateMutability: 'payable',
		type: 'function',
	},
	{
		stateMutability: 'payable',
		type: 'receive',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: '_user',
				type: 'address',
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: '_amount',
				type: 'uint256',
			},
		],
		name: 'Compounded',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: '_user',
				type: 'address',
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: 'unlockable',
				type: 'uint256',
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: 'ineligInRdnt',
				type: 'uint256',
			},
		],
		name: 'ExpiredLocksRemoved',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: 'user',
				type: 'address',
			},
			{
				indexed: true,
				internalType: 'address',
				name: 'rewardToken',
				type: 'address',
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: 'reward',
				type: 'uint256',
			},
		],
		name: 'IneligibleRewardRemoved',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: 'user',
				type: 'address',
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: 'usdValue',
				type: 'uint256',
			},
			{
				indexed: false,
				internalType: 'bool',
				name: 'isLP',
				type: 'bool',
			},
		],
		name: 'Locked',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: 'previousOwner',
				type: 'address',
			},
			{
				indexed: true,
				internalType: 'address',
				name: 'newOwner',
				type: 'address',
			},
		],
		name: 'OwnershipTransferred',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: 'address',
				name: 'token',
				type: 'address',
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: 'amount',
				type: 'uint256',
			},
		],
		name: 'Recovered',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: 'user',
				type: 'address',
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: 'amount',
				type: 'uint256',
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: 'lockIndex',
				type: 'uint256',
			},
		],
		name: 'Relocked',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: 'uint256',
				name: 'reward',
				type: 'uint256',
			},
		],
		name: 'RewardAdded',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: 'user',
				type: 'address',
			},
			{
				indexed: true,
				internalType: 'address',
				name: 'rewardToken',
				type: 'address',
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: 'reward',
				type: 'uint256',
			},
		],
		name: 'RewardPaid',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: false,
				internalType: 'address',
				name: 'token',
				type: 'address',
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: 'newDuration',
				type: 'uint256',
			},
		],
		name: 'RewardsDurationUpdated',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: 'user',
				type: 'address',
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: 'amount',
				type: 'uint256',
			},
			{
				indexed: false,
				internalType: 'bool',
				name: 'locked',
				type: 'bool',
			},
		],
		name: 'Staked',
		type: 'event',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: 'user',
				type: 'address',
			},
			{
				indexed: true,
				internalType: 'address',
				name: 'token',
				type: 'address',
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: 'receivedAmount',
				type: 'uint256',
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: 'penalty',
				type: 'uint256',
			},
			{
				indexed: false,
				internalType: 'uint256',
				name: 'burn',
				type: 'uint256',
			},
		],
		name: 'Withdrawn',
		type: 'event',
	},
	{
		inputs: [],
		name: 'AC_ENABLED',
		outputs: [
			{
				internalType: 'bool',
				name: '',
				type: 'bool',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'BOUNTY_ENABLED',
		outputs: [
			{
				internalType: 'bool',
				name: '',
				type: 'bool',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'BURN',
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
		name: 'BountyManager',
		outputs: [
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'DEFAULT_LOCK_DURATION',
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
		name: 'DEFAULT_LOCK_INDEX',
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
		name: 'HALF',
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
		name: 'QUART',
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
		name: 'REWARDS_DURATION',
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
		name: 'REWARDS_LOOKBACK',
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
		name: 'STARFLEET_TREASURY',
		outputs: [
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'VEST_DURATION',
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
		name: 'WHOLE',
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
				name: '_bounty',
				type: 'address',
			},
		],
		name: 'addBountyContract',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: '_rewardToken',
				type: 'address',
			},
		],
		name: 'addReward',
		outputs: [],
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
		name: 'autoRelockDisabled',
		outputs: [
			{
				internalType: 'bool',
				name: '',
				type: 'bool',
			},
		],
		stateMutability: 'view',
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
		name: 'autocompoundEnabled',
		outputs: [
			{
				internalType: 'bool',
				name: '',
				type: 'bool',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'autocompoundFee',
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
		name: 'autocompoundThreshold',
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
		name: 'baseToken',
		outputs: [
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: '_user',
				type: 'address',
			},
		],
		name: 'bountyForUser',
		outputs: [
			{
				components: [
					{
						internalType: 'address',
						name: 'token',
						type: 'address',
					},
					{
						internalType: 'uint256',
						name: 'amount',
						type: 'uint256',
					},
				],
				internalType: 'struct IFeeDistribution.RewardData[]',
				name: 'bounties',
				type: 'tuple[]',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'bountyManager',
		outputs: [
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: '_user',
				type: 'address',
			},
			{
				internalType: 'bool',
				name: '_execute',
				type: 'bool',
			},
		],
		name: 'claimBounty',
		outputs: [
			{
				internalType: 'uint256',
				name: 'bountyAmt',
				type: 'uint256',
			},
			{
				internalType: 'bool',
				name: 'issueBaseBounty',
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
				name: '_user',
				type: 'address',
			},
			{
				internalType: 'bool',
				name: '_execute',
				type: 'bool',
			},
		],
		name: 'claimCompound',
		outputs: [
			{
				internalType: 'uint256',
				name: 'tokensOut',
				type: 'uint256',
			},
		],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'account',
				type: 'address',
			},
		],
		name: 'claimableRewards',
		outputs: [
			{
				components: [
					{
						internalType: 'address',
						name: 'token',
						type: 'address',
					},
					{
						internalType: 'uint256',
						name: 'amount',
						type: 'uint256',
					},
				],
				internalType: 'struct IFeeDistribution.RewardData[]',
				name: 'rewardsData',
				type: 'tuple[]',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'compoundAcceptableSlippage',
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
				name: '_user',
				type: 'address',
			},
		],
		name: 'convertPendingRewardsToWeth',
		outputs: [
			{
				internalType: 'uint256',
				name: 'wethOut',
				type: 'uint256',
			},
		],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [],
		name: 'daoTreasury',
		outputs: [
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'view',
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
		name: 'defaultLockIndex',
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
				name: 'user',
				type: 'address',
			},
		],
		name: 'earnedBalances',
		outputs: [
			{
				internalType: 'uint256',
				name: 'total',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: 'unlocked',
				type: 'uint256',
			},
			{
				components: [
					{
						internalType: 'uint256',
						name: 'amount',
						type: 'uint256',
					},
					{
						internalType: 'uint256',
						name: 'unlockTime',
						type: 'uint256',
					},
					{
						internalType: 'uint256',
						name: 'penalty',
						type: 'uint256',
					},
				],
				internalType: 'struct EarnedBalance[]',
				name: 'earningsData',
				type: 'tuple[]',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'bool',
				name: 'claimRewards',
				type: 'bool',
			},
		],
		name: 'exit',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [],
		name: 'getAllRewards',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [],
		name: 'getLockDurations',
		outputs: [
			{
				internalType: 'uint256[]',
				name: '',
				type: 'uint256[]',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'getLockMultipliers',
		outputs: [
			{
				internalType: 'uint256[]',
				name: '',
				type: 'uint256[]',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address[]',
				name: '_rewardTokens',
				type: 'address[]',
			},
		],
		name: 'getReward',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: '_rewardToken',
				type: 'address',
			},
		],
		name: 'getRewardForDuration',
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
		name: 'incentivesController',
		outputs: [
			{
				internalType: 'contract IChefIncentivesController',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'bool',
				name: 'claimRewards',
				type: 'bool',
			},
			{
				internalType: 'uint256',
				name: 'unlockTime',
				type: 'uint256',
			},
		],
		name: 'individualEarlyExit',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: '_rdntToken',
				type: 'address',
			},
			{
				internalType: 'address',
				name: '_lockZap',
				type: 'address',
			},
			{
				internalType: 'address',
				name: '_dao',
				type: 'address',
			},
			{
				internalType: 'address',
				name: '_userlist',
				type: 'address',
			},
			{
				internalType: 'address',
				name: 'priceProvider',
				type: 'address',
			},
			{
				internalType: 'uint256',
				name: '_rewardsDuration',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: '_rewardsLookback',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: '_lockDuration',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: '_burnRatio',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: '_vestDuration',
				type: 'uint256',
			},
		],
		name: 'initialize',
		outputs: [],
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
		name: 'lastAutocompound',
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
				name: '',
				type: 'address',
			},
		],
		name: 'lastClaimTime',
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
				name: '_rewardToken',
				type: 'address',
			},
		],
		name: 'lastTimeRewardApplicable',
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
				name: 'user',
				type: 'address',
			},
		],
		name: 'lockInfo',
		outputs: [
			{
				components: [
					{
						internalType: 'uint256',
						name: 'amount',
						type: 'uint256',
					},
					{
						internalType: 'uint256',
						name: 'unlockTime',
						type: 'uint256',
					},
					{
						internalType: 'uint256',
						name: 'multiplier',
						type: 'uint256',
					},
					{
						internalType: 'uint256',
						name: 'duration',
						type: 'uint256',
					},
				],
				internalType: 'struct LockedBalance[]',
				name: '',
				type: 'tuple[]',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'user',
				type: 'address',
			},
		],
		name: 'lockedBalances',
		outputs: [
			{
				internalType: 'uint256',
				name: 'total',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: 'unlockable',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: 'locked',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: 'lockedWithMultiplier',
				type: 'uint256',
			},
			{
				components: [
					{
						internalType: 'uint256',
						name: 'amount',
						type: 'uint256',
					},
					{
						internalType: 'uint256',
						name: 'unlockTime',
						type: 'uint256',
					},
					{
						internalType: 'uint256',
						name: 'multiplier',
						type: 'uint256',
					},
					{
						internalType: 'uint256',
						name: 'duration',
						type: 'uint256',
					},
				],
				internalType: 'struct LockedBalance[]',
				name: 'lockData',
				type: 'tuple[]',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'lockedSupply',
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
		name: 'lockedSupplyWithMultiplier',
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
		name: 'mfdHelper',
		outputs: [
			{
				internalType: 'contract IMFDHelper',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'middleFeeDistribution',
		outputs: [
			{
				internalType: 'contract IMiddleFeeDistribution',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'user',
				type: 'address',
			},
			{
				internalType: 'uint256',
				name: 'amount',
				type: 'uint256',
			},
			{
				internalType: 'bool',
				name: 'withPenalty',
				type: 'bool',
			},
		],
		name: 'mint',
		outputs: [],
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
		name: 'minters',
		outputs: [
			{
				internalType: 'bool',
				name: '',
				type: 'bool',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'mintersAreSet',
		outputs: [
			{
				internalType: 'bool',
				name: '',
				type: 'bool',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'owner',
		outputs: [
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'quoteSelfCompound',
		outputs: [
			{
				internalType: 'uint256',
				name: 'tokensOut',
				type: 'uint256',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'rdntToken',
		outputs: [
			{
				internalType: 'contract IMintableToken',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'relock',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [],
		name: 'renounceOwnership',
		outputs: [],
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
		name: 'rewardData',
		outputs: [
			{
				internalType: 'uint256',
				name: 'periodFinish',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: 'rewardPerSecond',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: 'lastUpdateTime',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: 'rewardPerTokenStored',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: 'balance',
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
				name: '_rewardToken',
				type: 'address',
			},
		],
		name: 'rewardPerToken',
		outputs: [
			{
				internalType: 'uint256',
				name: 'rptStored',
				type: 'uint256',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'uint256',
				name: '',
				type: 'uint256',
			},
		],
		name: 'rewardTokens',
		outputs: [
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'view',
		type: 'function',
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
		name: 'rewards',
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
				internalType: 'uint256',
				name: '_quote',
				type: 'uint256',
			},
		],
		name: 'selfCompound',
		outputs: [
			{
				internalType: 'uint256',
				name: 'tokensOut',
				type: 'uint256',
			},
		],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'contract IChefIncentivesController',
				name: '_controller',
				type: 'address',
			},
			{
				internalType: 'contract IMiddleFeeDistribution',
				name: '_middleFeeDistribution',
				type: 'address',
			},
			{
				internalType: 'address',
				name: '_treasury',
				type: 'address',
			},
		],
		name: 'setAddresses',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'bool',
				name: '_status',
				type: 'bool',
			},
		],
		name: 'setAutocompound',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: '_baseToken',
				type: 'address',
			},
			{
				internalType: 'address',
				name: '_uniRouter',
				type: 'address',
			},
			{
				internalType: 'address',
				name: '_bountyManager',
				type: 'address',
			},
			{
				internalType: 'address',
				name: '_mfdHelper',
				type: 'address',
			},
			{
				internalType: 'bool',
				name: '_bountyEnabled',
				type: 'bool',
			},
			{
				internalType: 'bool',
				name: '_acEnabled',
				type: 'bool',
			},
			{
				internalType: 'uint256',
				name: '_autocompoundThreshold',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: '_autocompoundFee',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: '_compoundAcceptableSlippage',
				type: 'uint256',
			},
		],
		name: 'setCompoundOptions',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'uint256',
				name: '_index',
				type: 'uint256',
			},
		],
		name: 'setDefaultRelockTypeIndex',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: '_stakingToken',
				type: 'address',
			},
		],
		name: 'setLPToken',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'uint256[]',
				name: '_lockPeriod',
				type: 'uint256[]',
			},
			{
				internalType: 'uint256[]',
				name: '_rewardMultipliers',
				type: 'uint256[]',
			},
		],
		name: 'setLockTypeInfo',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address[]',
				name: '_minters',
				type: 'address[]',
			},
		],
		name: 'setMinters',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'bool',
				name: '_status',
				type: 'bool',
			},
		],
		name: 'setRelock',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'uint256',
				name: 'amount',
				type: 'uint256',
			},
			{
				internalType: 'address',
				name: 'onBehalfOf',
				type: 'address',
			},
			{
				internalType: 'uint256',
				name: 'typeIndex',
				type: 'uint256',
			},
		],
		name: 'stake',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [],
		name: 'stakingToken',
		outputs: [
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'user',
				type: 'address',
			},
		],
		name: 'totalBalance',
		outputs: [
			{
				internalType: 'uint256',
				name: 'amount',
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
				name: 'newOwner',
				type: 'address',
			},
		],
		name: 'transferOwnership',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [],
		name: 'uniRouter',
		outputs: [
			{
				internalType: 'address',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'view',
		type: 'function',
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
		name: 'userRewardPerTokenPaid',
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
		name: 'userlist',
		outputs: [
			{
				internalType: 'contract ILockerList',
				name: '',
				type: 'address',
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'uint256',
				name: 'amount',
				type: 'uint256',
			},
		],
		name: 'withdraw',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: '_address',
				type: 'address',
			},
		],
		name: 'withdrawExpiredLocksFor',
		outputs: [
			{
				internalType: 'uint256',
				name: '',
				type: 'uint256',
			},
		],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: '_address',
				type: 'address',
			},
			{
				internalType: 'uint256',
				name: '_limit',
				type: 'uint256',
			},
			{
				internalType: 'bool',
				name: '_ignoreRelock',
				type: 'bool',
			},
		],
		name: 'withdrawExpiredLocksForWithOptions',
		outputs: [
			{
				internalType: 'uint256',
				name: '',
				type: 'uint256',
			},
		],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: 'user',
				type: 'address',
			},
		],
		name: 'withdrawableBalance',
		outputs: [
			{
				internalType: 'uint256',
				name: 'amount',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: 'penaltyAmount',
				type: 'uint256',
			},
			{
				internalType: 'uint256',
				name: 'burnAmount',
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
				name: '_user',
				type: 'address',
			},
		],
		name: 'zapVestingToLp',
		outputs: [
			{
				internalType: 'uint256',
				name: 'zapped',
				type: 'uint256',
			},
		],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{
				internalType: 'address',
				name: '_logic',
				type: 'address',
			},
			{
				internalType: 'address',
				name: 'admin_',
				type: 'address',
			},
			{
				internalType: 'bytes',
				name: '_data',
				type: 'bytes',
			},
		],
		stateMutability: 'payable',
		type: 'constructor',
	},
];
exports.handler = async function (credentials) {
	// Initialize defender relayer provider and signer
	const provider = new DefenderRelayProvider(credentials);
	const signer = new DefenderRelaySigner(credentials, provider, {speed: 'fast'});

	const mfd = new ethers.Contract(mfdAddr, mfdAbi, signer);
	// if (await contract.canExecute()) {
	const tx = await mfd.getAllRewards();
	await tx.wait();

	console.log(`Called execute in ${tx.hash}`);
	return {tx: tx.hash};
};

// To run locally (this code will not be executed in Autotasks)
if (require.main === module) {
	const {API_KEY: apiKey, API_SECRET: apiSecret} = process.env;
	exports
		.handler({apiKey, apiSecret})
		.then(() => process.exit(0))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
