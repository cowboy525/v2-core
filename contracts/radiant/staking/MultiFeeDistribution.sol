// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;


import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import {RecoverERC20} from "../libraries/RecoverERC20.sol";
import {IChefIncentivesController} from "../../interfaces/IChefIncentivesController.sol";
import {IMiddleFeeDistribution} from "../../interfaces/IMiddleFeeDistribution.sol";
import {IBountyManager} from "../../interfaces/IBountyManager.sol";
import {IMultiFeeDistribution, IFeeDistribution} from "../../interfaces/IMultiFeeDistribution.sol";
import {IMintableToken} from "../../interfaces/IMintableToken.sol";
import {ILockerList} from "../../interfaces/ILockerList.sol";
import {LockedBalance, Balances, Reward, EarnedBalance} from "../../interfaces/LockedBalance.sol";
import {IPriceProvider} from "../../interfaces/IPriceProvider.sol";

/// @title Multi Fee Distribution Contract
/// @author Radiant
contract MultiFeeDistribution is
	IMultiFeeDistribution,
	Initializable,
	PausableUpgradeable,
	OwnableUpgradeable,
	RecoverERC20
{
	using SafeERC20 for IERC20;
	using SafeERC20 for IMintableToken;

	address private _priceProvider;

	/********************** Constants ***********************/

	uint256 public constant QUART = 25000; //  25%
	uint256 public constant HALF = 65000; //  65%
	uint256 public constant WHOLE = 100000; // 100%

	/// @notice Proportion of burn amount
	uint256 public burn;

	/// @notice Duration that rewards are streamed over
	uint256 public rewardsDuration;

	/// @notice Duration that rewards loop back
	uint256 public rewardsLookback;

	/// @notice Default lock index
	uint256 public constant DEFAULT_LOCK_INDEX = 1;

	/// @notice Duration of lock/earned penalty period, used for earnings
	uint256 public defaultLockDuration;

	/// @notice Duration of vesting RDNT
	uint256 public vestDuration;

	/// @notice Returns reward converter
	address public rewardConverter;

	/********************** Contract Addresses ***********************/

	/// @notice Address of Middle Fee Distribution Contract
	IMiddleFeeDistribution public middleFeeDistribution;

	/// @notice Address of CIC contract
	IChefIncentivesController public incentivesController;

	/// @notice Address of RDNT
	IMintableToken public rdntToken;

	/// @notice Address of LP token
	address public stakingToken;

	// Address of Lock Zapper
	address internal lockZap;

	/********************** Lock & Earn Info ***********************/

	// Private mappings for balance data
	mapping(address => Balances) private balances;
	mapping(address => LockedBalance[]) internal userLocks;
	mapping(address => LockedBalance[]) private userEarnings;
	mapping(address => bool) public autocompoundEnabled;
	mapping(address => uint256) public lastAutocompound;

	/// @notice Total locked value
	uint256 public lockedSupply;

	/// @notice Total locked value in multipliers
	uint256 public lockedSupplyWithMultiplier;

	// Time lengths
	uint256[] internal lockPeriod;

	// Multipliers
	uint256[] internal rewardMultipliers;

	/********************** Reward Info ***********************/

	/// @notice Reward tokens being distributed
	address[] public rewardTokens;

	/// @notice Reward data per token
	mapping(address => Reward) public rewardData;

	/// @notice user -> reward token -> rpt; RPT for paid amount
	mapping(address => mapping(address => uint256)) public userRewardPerTokenPaid;

	/// @notice user -> reward token -> amount; used to store reward amount
	mapping(address => mapping(address => uint256)) public rewards;

	/********************** Other Info ***********************/

	/// @notice DAO wallet
	address public daoTreasury;

	/// @notice treasury wallet
	address public starfleetTreasury;

	/// @notice Addresses approved to call mint
	mapping(address => bool) public minters;

	// Addresses to relock
	mapping(address => bool) public autoRelockDisabled;

	// Default lock index for relock
	mapping(address => uint256) public defaultLockIndex;

	/// @notice Flag to prevent more minter addings
	bool public mintersAreSet;

	/// @notice Users list
	ILockerList public userlist;

	/// @notice Last claim time of the user
	mapping(address => uint256) public lastClaimTime;

	/// @notice Bounty manager contract
	address public bountyManager;

	/********************** Events ***********************/

	event Locked(address indexed user, uint256 amount, uint256 lockedBalance, bool isLP);
	event Withdrawn(
		address indexed user,
		uint256 receivedAmount,
		uint256 lockedBalance,
		uint256 penalty,
		uint256 burn,
		bool isLP
	);
	event RewardPaid(address indexed user, address indexed rewardToken, uint256 reward);
	event Relocked(address indexed user, uint256 amount, uint256 lockIndex);
	event BountyManagerUpdated(address indexed _bounty);
	event RewardConverterUpdated(address indexed _rewardConverter);
	event LockTypeInfoUpdated(uint256[] lockPeriod, uint256[] rewardMultipliers);
	event AddressesUpdated(
		IChefIncentivesController _controller,
		IMiddleFeeDistribution _middleFeeDistribution,
		address indexed _treasury
	);
	event LPTokenUpdated(address indexed _stakingToken);
	event RewardAdded(address indexed _rewardToken);

	/********************** Errors ***********************/
	error AddressZero();
	error AmountZero();
	error InvalidBurn();
	error InvalidLookback();
	error MintersSet();
	error InvalidLockPeriod();
	error InsufficientPermission();
	error AlreadyAdded();
	error AlreadySet();
	error InvalidType();
	error ActiveReward();
	error InvalidAmount();
	error InvalidEarned();
	error InvalidTime();
	error InvalidPeriod();
	error UnlockTimeNotFound();
	error InvalidAddress();

	constructor() {
		_disableInitializers();
	}

	/**
	 * @dev Initializer
	 *  First reward MUST be the RDNT token or things will break
	 *  related to the 50% penalty and distribution to locked balances.
	 * @param _rdntToken RDNT token address
	 * @param _lockZap LockZap contract address
	 * @param _dao DAO address
	 * @param _userlist UserList contract address
	 * @param priceProvider PriceProvider contract address
	 * @param _rewardsDuration Duration that rewards are streamed over
	 * @param _rewardsLookback Duration that rewards loop back
	 * @param _lockDuration lock duration
	 * @param _burnRatio Proportion of burn amount
	 * @param _vestDuration vest duration
	 */
	function initialize(
		address _rdntToken,
		address _lockZap,
		address _dao,
		address _userlist,
		address priceProvider,
		uint256 _rewardsDuration,
		uint256 _rewardsLookback,
		uint256 _lockDuration,
		uint256 _burnRatio,
		uint256 _vestDuration
	) public initializer {
		if (_rdntToken == address(0)) revert AddressZero();
		if (_lockZap == address(0)) revert AddressZero();
		if (_dao == address(0)) revert AddressZero();
		if (_userlist == address(0)) revert AddressZero();
		if (priceProvider == address(0)) revert AddressZero();
		if (_rewardsDuration == uint256(0)) revert AmountZero();
		if (_rewardsLookback == uint256(0)) revert AmountZero();
		if (_lockDuration == uint256(0)) revert AmountZero();
		if (_vestDuration == uint256(0)) revert AmountZero();
		if (_burnRatio > WHOLE) revert InvalidBurn();
		if (_rewardsLookback > _rewardsDuration) revert InvalidLookback();

		__Pausable_init();
		__Ownable_init();

		rdntToken = IMintableToken(_rdntToken);
		lockZap = _lockZap;
		daoTreasury = _dao;
		_priceProvider = priceProvider;
		userlist = ILockerList(_userlist);
		rewardTokens.push(_rdntToken);
		rewardData[_rdntToken].lastUpdateTime = block.timestamp;

		rewardsDuration = _rewardsDuration;
		rewardsLookback = _rewardsLookback;
		defaultLockDuration = _lockDuration;
		burn = _burnRatio;
		vestDuration = _vestDuration;
	}

	/********************** Setters ***********************/

	/**
	 * @notice Set minters
	 * @dev Can be called only once
	 * @param _minters array of address
	 */
	function setMinters(address[] calldata _minters) external onlyOwner {
		if (mintersAreSet) revert MintersSet();
		uint256 length = _minters.length;
		for (uint256 i; i < length; ) {
			if (_minters[i] == address(0)) revert AddressZero();
			minters[_minters[i]] = true;
			unchecked {
				i++;
			}
		}
		mintersAreSet = true;
	}

	/**
	 * @notice Sets bounty manager contract.
	 * @param _bounty contract address
	 */
	function setBountyManager(address _bounty) external onlyOwner {
		if (_bounty == address(0)) revert AddressZero();
		bountyManager = _bounty;
		minters[_bounty] = true;
		emit BountyManagerUpdated(_bounty);
	}

	/**
	 * @notice Sets reward converter contract.
	 * @param _rewardConverter contract address
	 */
	function addRewardConverter(address _rewardConverter) external onlyOwner {
		if (_rewardConverter == address(0)) revert AddressZero();
		rewardConverter = _rewardConverter;
		emit RewardConverterUpdated(_rewardConverter);
	}

	/**
	 * @notice Sets lock period and reward multipliers.
	 * @param _lockPeriod lock period array
	 * @param _rewardMultipliers multipliers per lock period
	 */
	function setLockTypeInfo(uint256[] calldata _lockPeriod, uint256[] calldata _rewardMultipliers) external onlyOwner {
		if (_lockPeriod.length != _rewardMultipliers.length) revert InvalidLockPeriod();
		delete lockPeriod;
		delete rewardMultipliers;
		uint256 length = _lockPeriod.length;
		for (uint256 i; i < length; ) {
			lockPeriod.push(_lockPeriod[i]);
			rewardMultipliers.push(_rewardMultipliers[i]);
			unchecked {
				i++;
			}
		}
		emit LockTypeInfoUpdated(lockPeriod, rewardMultipliers);
	}

	/**
	 * @notice Set CIC, MFD and Treasury.
	 * @param _controller CIC address
	 * @param _middleFeeDistribution address
	 * @param _treasury address
	 */
	function setAddresses(
		IChefIncentivesController _controller,
		IMiddleFeeDistribution _middleFeeDistribution,
		address _treasury
	) external onlyOwner {
		if (address(_controller) == address(0)) revert AddressZero();
		if (address(_middleFeeDistribution) == address(0)) revert AddressZero();
		incentivesController = _controller;
		middleFeeDistribution = _middleFeeDistribution;
		starfleetTreasury = _treasury;
		emit AddressesUpdated(_controller, _middleFeeDistribution, _treasury);
	}

	/**
	 * @notice Set LP token.
	 * @param _stakingToken LP token address
	 */
	function setLPToken(address _stakingToken) external onlyOwner {
		if (_stakingToken == address(0)) revert AddressZero();
		if (stakingToken != address(0)) revert AlreadySet();
		stakingToken = _stakingToken;
		emit LPTokenUpdated(_stakingToken);
	}

	/**
	 * @notice Add a new reward token to be distributed to stakers.
	 * @param _rewardToken address
	 */
	function addReward(address _rewardToken) external {
		if (_rewardToken == address(0)) revert AddressZero();
		if (!minters[msg.sender]) revert InsufficientPermission();
		if (rewardData[_rewardToken].lastUpdateTime != 0) revert AlreadyAdded();
		rewardTokens.push(_rewardToken);

		Reward storage rewardData = rewardData[_rewardToken];
		rewardData.lastUpdateTime = block.timestamp;
		rewardData.periodFinish = block.timestamp;

		emit RewardAdded(_rewardToken);
	}

	/**
	 * @notice Remove an existing reward token.
	 * @param _rewardToken address to be removed
	 */
	function removeReward(address _rewardToken) external override {
		if (!minters[msg.sender]) revert InsufficientPermission();

		bool isTokenFound;
		uint256 indexToRemove;

		uint256 length = rewardTokens.length;
		for (uint256 i; i < length; i++) {
			if (rewardTokens[i] == _rewardToken) {
				isTokenFound = true;
				indexToRemove = i;
				break;
			}
		}

		if (!isTokenFound) revert InvalidAddress();


		// Reward token order is changed, but that doesn't have an impact
		if (indexToRemove < length - 1) {
			rewardTokens[indexToRemove] = rewardTokens[length - 1];
		}

		rewardTokens.pop();

		// Scrub historical reward token data
		Reward storage rd = rewardData[_rewardToken];
		rd.lastUpdateTime = 0;
		rd.periodFinish = 0;
		rd.balance = 0;
		rd.rewardPerSecond = 0;
		rd.rewardPerTokenStored = 0;
	}

	/********************** View functions ***********************/

	/**
	 * @notice Set default lock type index for user relock.
	 * @param _index of default lock length
	 */
	function setDefaultRelockTypeIndex(uint256 _index) external {
		if (_index >= lockPeriod.length) revert InvalidType();
		defaultLockIndex[msg.sender] = _index;
	}

	/**
	 * @notice Sets option if auto compound is enabled.
	 * @param _status true if auto compounding is enabled.
	 */
	function setAutocompound(bool _status) external {
		autocompoundEnabled[msg.sender] = _status;
	}

	/**
	 * @notice Set relock status
	 * @param _status true if auto relock is enabled.
	 */
	function setRelock(bool _status) external virtual {
		autoRelockDisabled[msg.sender] = !_status;
	}

	/********************** View functions ***********************/

	/**
	 * @notice Return lock duration.
	 */
	function getLockDurations() external view returns (uint256[] memory) {
		return lockPeriod;
	}

	/**
	 * @notice Return reward multipliers.
	 */
	function getLockMultipliers() external view returns (uint256[] memory) {
		return rewardMultipliers;
	}

	/**
	 * @notice Returns all locks of a user.
	 * @param user address.
	 * @return lockInfo of the user.
	 */
	function lockInfo(address user) external view returns (LockedBalance[] memory) {
		return userLocks[user];
	}

	/**
	 * @notice Total balance of an account, including unlocked, locked and earned tokens.
	 * @param user address.
	 */
	function totalBalance(address user) external view returns (uint256) {
		if (stakingToken == address(rdntToken)) {
			return balances[user].total;
		}
		return balances[user].locked;
	}

	/**
	 * @notice Information on a user's lockings
	 * @return total balance of locks
	 * @return unlockable balance
	 * @return locked balance
	 * @return lockedWithMultiplier
	 * @return lockData which is an array of locks
	 */
	function lockedBalances(
		address user
	)
		public
		view
		returns (
			uint256 total,
			uint256 unlockable,
			uint256 locked,
			uint256 lockedWithMultiplier,
			LockedBalance[] memory lockData
		)
	{
		LockedBalance[] storage locks = userLocks[user];
		uint256 idx;
		uint256 length = locks.length;
		for (uint256 i; i < length; ) {
			if (locks[i].unlockTime > block.timestamp) {
				if (idx == 0) {
					lockData = new LockedBalance[](locks.length - i);
				}
				lockData[idx] = locks[i];
				idx++;
				locked = locked + locks[i].amount;
				lockedWithMultiplier = lockedWithMultiplier + (locks[i].amount * locks[i].multiplier);
			} else {
				unlockable = unlockable + locks[i].amount;
			}
			unchecked {
				i++;
			}
		}
		total = balances[user].locked;
	}

	/**
	 * @notice Reward locked amount of the user.
	 * @param user address
	 * @return locked amount
	 */
	function lockedBalance(address user) public view returns (uint256 locked) {
		LockedBalance[] storage locks = userLocks[user];
		uint256 length = locks.length;
		for (uint256 i; i < length; ) {
			if (locks[i].unlockTime > block.timestamp) {
				locked = locked + locks[i].amount;
			}
			unchecked {
				i++;
			}
		}
	}

	/**
	 * @notice Earnings which are vesting, and earnings which have vested for full duration.
	 * @dev Earned balances may be withdrawn immediately, but will incur a penalty between 25-90%, based on a linear schedule of elapsed time.
	 * @return total earnings
	 * @return unlocked earnings
	 * @return earningsData which is an array of all infos
	 */
	function earnedBalances(
		address user
	) public view returns (uint256 total, uint256 unlocked, EarnedBalance[] memory earningsData) {
		unlocked = balances[user].unlocked;
		LockedBalance[] storage earnings = userEarnings[user];
		uint256 idx;
		uint256 length = earnings.length;
		for (uint256 i; i < length; ) {
			if (earnings[i].unlockTime > block.timestamp) {
				if (idx == 0) {
					earningsData = new EarnedBalance[](earnings.length - i);
				}
				(, uint256 penaltyAmount, , ) = ieeWithdrawableBalance(user, earnings[i].unlockTime);
				earningsData[idx].amount = earnings[i].amount;
				earningsData[idx].unlockTime = earnings[i].unlockTime;
				earningsData[idx].penalty = penaltyAmount;
				idx++;
				total = total + earnings[i].amount;
			} else {
				unlocked = unlocked + earnings[i].amount;
			}
			unchecked {
				i++;
			}
		}
		return (total, unlocked, earningsData);
	}

	/**
	 * @notice Total balance of an account, including unlocked, locked and earned tokens.
	 */
	function getBalances(address _user) external view returns (Balances memory) {
		return balances[_user];
	}

	/**
	 * @notice Final balance received and penalty balance paid by user upon calling exit.
	 * @dev This is earnings, not locks.
	 * @param user address.
	 * @return amount total withdrawable amount.
	 * @return penaltyAmount penalty amount.
	 * @return burnAmount amount to burn.
	 */
	function withdrawableBalance(
		address user
	) public view returns (uint256 amount, uint256 penaltyAmount, uint256 burnAmount) {
		uint256 earned = balances[user].earned;
		if (earned > 0) {
			uint256 length = userEarnings[user].length;
			for (uint256 i; i < length; ) {
				uint256 earnedAmount = userEarnings[user][i].amount;
				if (earnedAmount == 0) continue;
				(, , uint256 newPenaltyAmount, uint256 newBurnAmount) = _penaltyInfo(userEarnings[user][i]);
				penaltyAmount = penaltyAmount + newPenaltyAmount;
				burnAmount = burnAmount + newBurnAmount;
				unchecked {
					i++;
				}
			}
		}
		amount = balances[user].unlocked + earned - penaltyAmount;
		return (amount, penaltyAmount, burnAmount);
	}

	/**
	 * @notice Penalty information of individual earning
	 * @param earning earning info.
	 * @return amount of available earning.
	 * @return penaltyFactor penalty rate.
	 * @return penaltyAmount amount of penalty.
	 * @return burnAmount amount to burn.
	 */
	function _penaltyInfo(
		LockedBalance memory earning
	) internal view returns (uint256 amount, uint256 penaltyFactor, uint256 penaltyAmount, uint256 burnAmount) {
		if (earning.unlockTime > block.timestamp) {
			// 90% on day 1, decays to 25% on day 90
			penaltyFactor = (earning.unlockTime - block.timestamp) * HALF / vestDuration + QUART; // 25% + timeLeft/vestDuration * 65%
			penaltyAmount = earning.amount * penaltyFactor / WHOLE;
			burnAmount = penaltyAmount * burn / WHOLE;
		}
		amount = earning.amount - penaltyAmount;
	}

	/********************** Reward functions ***********************/

	/**
	 * @notice Reward amount of the duration.
	 * @param _rewardToken for the reward
	 * @return reward amount for duration
	 */
	function getRewardForDuration(address _rewardToken) external view returns (uint256) {
		return rewardData[_rewardToken].rewardPerSecond * rewardsDuration / 1e12;
	}

	/**
	 * @notice Returns reward applicable timestamp.
	 * @param _rewardToken for the reward
	 * @return end time of reward period
	 */
	function lastTimeRewardApplicable(address _rewardToken) public view returns (uint256) {
		uint256 periodFinish = rewardData[_rewardToken].periodFinish;
		return block.timestamp < periodFinish ? block.timestamp : periodFinish;
	}

	/**
	 * @notice Reward amount per token
	 * @dev Reward is distributed only for locks.
	 * @param _rewardToken for reward
	 * @return rptStored current RPT with accumulated rewards
	 */
	function rewardPerToken(address _rewardToken) public view returns (uint256 rptStored) {
		rptStored = rewardData[_rewardToken].rewardPerTokenStored;
		if (lockedSupplyWithMultiplier > 0) {
			uint256 newReward = (lastTimeRewardApplicable(_rewardToken) - rewardData[_rewardToken].lastUpdateTime) *
				rewardData[_rewardToken].rewardPerSecond
			;
			rptStored = rptStored + (newReward * 1e18 / lockedSupplyWithMultiplier);
		}
	}

	/**
	 * @notice Address and claimable amount of all reward tokens for the given account.
	 * @param account for rewards
	 * @return rewardsData array of rewards
	 */
	function claimableRewards(
		address account
	) public view returns (IFeeDistribution.RewardData[] memory rewardsData) {
		rewardsData = new IFeeDistribution.RewardData[](rewardTokens.length);

		uint256 length = rewardTokens.length;
		for (uint256 i; i < length; ) {
			rewardsData[i].token = rewardTokens[i];
			rewardsData[i].amount = _earned(
				account,
				rewardsData[i].token,
				balances[account].lockedWithMultiplier,
				rewardPerToken(rewardsData[i].token)
			) / 1e12;
			unchecked {
				i++;
			}
		}
		return rewardsData;
	}

	/**
	 * @notice Claim rewards by converter.
	 * @dev Rewards are transferred to converter.
	 * @param onBehalf address to claim.
	 */
	function claimFromConverter(address onBehalf) external whenNotPaused {
		if (msg.sender != rewardConverter) revert InsufficientPermission();
		_updateReward(onBehalf);
		middleFeeDistribution.forwardReward(rewardTokens);
		uint256 length = rewardTokens.length;
		for (uint256 i; i < length; ) {
			address token = rewardTokens[i];
			if (token != address(rdntToken)) {
				_notifyUnseenReward(token);
				uint256 reward = rewards[onBehalf][token] / 1e12;
				if (reward > 0) {
					rewards[onBehalf][token] = 0;
					rewardData[token].balance = rewardData[token].balance - reward;

					IERC20(token).safeTransfer(rewardConverter, reward);
					emit RewardPaid(onBehalf, token, reward);
				}
			}
			unchecked {
				i++;
			}
		}
		IPriceProvider(_priceProvider).update();
		lastClaimTime[onBehalf] = block.timestamp;
	}

	/********************** Operate functions ***********************/

	/**
	 * @notice Withdraw and restake assets.
	 */
	function relock() external virtual {
		uint256 amount = _withdrawExpiredLocksFor(msg.sender, true, true, userLocks[msg.sender].length);
		_stake(amount, msg.sender, defaultLockIndex[msg.sender], false);
		emit Relocked(msg.sender, amount, defaultLockIndex[msg.sender]);
	}

	/**
	 * @notice Stake tokens to receive rewards.
	 * @dev Locked tokens cannot be withdrawn for defaultLockDuration and are eligible to receive rewards.
	 * @param amount to stake.
	 * @param onBehalfOf address for staking.
	 * @param typeIndex lock type index.
	 */
	function stake(uint256 amount, address onBehalfOf, uint256 typeIndex) external {
		_stake(amount, onBehalfOf, typeIndex, false);
	}

	/**
	 * @notice Stake tokens to receive rewards.
	 * @dev Locked tokens cannot be withdrawn for defaultLockDuration and are eligible to receive rewards.
	 * @param amount to stake.
	 * @param onBehalfOf address for staking.
	 * @param typeIndex lock type index.
	 * @param isRelock true if this is with relock enabled.
	 */
	function _stake(uint256 amount, address onBehalfOf, uint256 typeIndex, bool isRelock) internal whenNotPaused {
		if (amount == 0) return;
		if (bountyManager != address(0)) {
			if (amount < IBountyManager(bountyManager).minDLPBalance()) revert InvalidAmount();
		}
		if (typeIndex >= lockPeriod.length) revert InvalidType();

		_updateReward(onBehalfOf);

		uint256 transferAmount = amount;
		if (userLocks[onBehalfOf].length != 0) {
			//if user has any locks
			if (userLocks[onBehalfOf][0].unlockTime <= block.timestamp) {
				//if user's soonest unlock has already elapsed
				if (onBehalfOf == msg.sender || msg.sender == lockZap) {
					//if the user is msg.sender or the lockzap contract
					uint256 withdrawnAmt;
					if (!autoRelockDisabled[onBehalfOf]) {
						withdrawnAmt = _withdrawExpiredLocksFor(onBehalfOf, true, false, userLocks[onBehalfOf].length);
						amount = amount + withdrawnAmt;
					} else {
						_withdrawExpiredLocksFor(onBehalfOf, true, true, userLocks[onBehalfOf].length);
					}
				}
			}
		}
		Balances storage bal = balances[onBehalfOf];
		bal.total = bal.total + amount;

		bal.locked = bal.locked + amount;
		lockedSupply = lockedSupply + amount;

		bal.lockedWithMultiplier = bal.lockedWithMultiplier + (amount * rewardMultipliers[typeIndex]);
		lockedSupplyWithMultiplier = lockedSupplyWithMultiplier + (amount * rewardMultipliers[typeIndex]);

		uint256 userLocksLength = userLocks[onBehalfOf].length;
		uint256 lastIndex = userLocksLength > 0 ? userLocksLength - 1 : 0;
		if (userLocksLength > 0){
			LockedBalance memory lastUserLock = userLocks[onBehalfOf][lastIndex];
			uint256 unlockDay = (block.timestamp + lockPeriod[typeIndex]) / 1 days;
			if ((lastUserLock.unlockTime / 1 days == unlockDay) && lastUserLock.multiplier == rewardMultipliers[typeIndex]) {
				userLocks[onBehalfOf][lastIndex].amount = lastUserLock.amount + amount;
			} else {
				_insertLock(
					onBehalfOf,
					LockedBalance({
						amount: amount,
						unlockTime: block.timestamp + lockPeriod[typeIndex],
						multiplier: rewardMultipliers[typeIndex],
						duration: lockPeriod[typeIndex]
					})
				);
				userlist.addToList(onBehalfOf);
			}
		} else {
			_insertLock(
				onBehalfOf,
				LockedBalance({
					amount: amount,
					unlockTime: block.timestamp + lockPeriod[typeIndex],
					multiplier: rewardMultipliers[typeIndex],
					duration: lockPeriod[typeIndex]
				})
			);
			userlist.addToList(onBehalfOf);
		}

		if (!isRelock) {
			IERC20(stakingToken).safeTransferFrom(msg.sender, address(this), transferAmount);
		}

		incentivesController.afterLockUpdate(onBehalfOf);
		emit Locked(onBehalfOf, amount, balances[onBehalfOf].locked, stakingToken != address(rdntToken));
	}

	/**
	 * @notice Add new lockings
	 * @dev We keep the array to be sorted by unlock time.
	 * @param _user address of locker.
	 * @param newLock new lock info.
	 */
	function _insertLock(address _user, LockedBalance memory newLock) internal {
		LockedBalance[] storage locks = userLocks[_user];
		uint256 length = locks.length;
		uint256 i = _binarySearch(locks, length, newLock.unlockTime);
		locks.push();
		for (uint256 j = length; j > i; ) {
			locks[j] = locks[j - 1];
			unchecked {
				j--;
			}
		}
		locks[i] = newLock;
	}

	function _binarySearch(
		LockedBalance[] storage locks,
		uint256 length,
		uint256 unlockTime
	) private view returns (uint256) {
		uint256 low = 0;
		uint256 high = length;
		while (low < high) {
			uint256 mid = (low + high) / 2;
			if (locks[mid].unlockTime < unlockTime) {
				low = mid + 1;
			} else {
				high = mid;
			}
		}
		return low;
	}

	/**
	 * @notice Add to earnings
	 * @dev Minted tokens receive rewards normally but incur a 50% penalty when
	 *  withdrawn before vestDuration has passed.
	 * @param user vesting owner.
	 * @param amount to vest.
	 * @param withPenalty does this bear penalty?
	 */
	function mint(address user, uint256 amount, bool withPenalty) external whenNotPaused {
		if (!minters[msg.sender]) revert InsufficientPermission();
		if (amount == 0) return;

		if (user == address(this)) {
			// minting to this contract adds the new tokens as incentives for lockers
			_notifyReward(address(rdntToken), amount);
			return;
		}

		Balances storage bal = balances[user];
		bal.total = bal.total + amount;
		if (withPenalty) {
			bal.earned = bal.earned + amount;
			LockedBalance[] storage earnings = userEarnings[user];
			
			uint256 currentDay = block.timestamp / 1 days;
			uint256 lastIndex = earnings.length > 0 ? earnings.length - 1 : 0;
			uint256 vestingDurationDays = vestDuration / 1 days;

			// We check if an entry for the current day already exists. If yes, add new amount to that entry
			if (earnings.length > 0 && (earnings[lastIndex].unlockTime / 1 days) == currentDay + vestingDurationDays) {
				earnings[lastIndex].amount = earnings[lastIndex].amount + amount;
			} else {
				// If there is no entry for the current day, create a new one
				uint256 unlockTime = block.timestamp + vestDuration;
				earnings.push(LockedBalance({
					amount: amount,
					unlockTime: unlockTime,
					multiplier: 1,
					duration: vestDuration
				}));
			}
		} else {
			bal.unlocked = bal.unlocked + amount;
		}
	}

	/**
	 * @notice Withdraw tokens from earnings and unlocked.
	 * @dev First withdraws unlocked tokens, then earned tokens. Withdrawing earned tokens
	 *  incurs a 50% penalty which is distributed based on locked balances.
	 * @param amount for withdraw
	 */
	function withdraw(uint256 amount) external {
		address _address = msg.sender;
		if (amount == 0) revert AmountZero();

		uint256 penaltyAmount;
		uint256 burnAmount;
		Balances storage bal = balances[_address];

		if (amount <= bal.unlocked) {
			bal.unlocked = bal.unlocked - amount;
		} else {
			uint256 remaining = amount - bal.unlocked;
			if (bal.earned < remaining) revert InvalidEarned();
			bal.unlocked = 0;
			uint256 sumEarned = bal.earned;
			uint256 i;
			for (i = 0; ; ) {
				uint256 earnedAmount = userEarnings[_address][i].amount;
				if (earnedAmount == 0) continue;
				(
					uint256 withdrawAmount,
					uint256 penaltyFactor,
					uint256 newPenaltyAmount,
					uint256 newBurnAmount
				) = _penaltyInfo(userEarnings[_address][i]);

				uint256 requiredAmount = earnedAmount;
				if (remaining >= withdrawAmount) {
					remaining = remaining - withdrawAmount;
					if (remaining == 0) i++;
				} else {
					requiredAmount = remaining * WHOLE / (WHOLE - penaltyFactor);
					userEarnings[_address][i].amount = earnedAmount - requiredAmount;
					remaining = 0;

					newPenaltyAmount = requiredAmount * penaltyFactor / WHOLE;
					newBurnAmount = newPenaltyAmount * burn / WHOLE;
				}
				sumEarned = sumEarned - requiredAmount;

				penaltyAmount = penaltyAmount + newPenaltyAmount;
				burnAmount = burnAmount + newBurnAmount;

				if (remaining == 0) {
					break;
				} else {
					if (sumEarned == 0) revert InvalidEarned();
				}
				unchecked {
					i++;
				}
			}
			if (i > 0) {
				uint256 length = userEarnings[_address].length;
				for (uint256 j = i; j < length; ) {
					userEarnings[_address][j - i] = userEarnings[_address][j];
					unchecked {
						j++;
					}
				}
				for (uint256 j = 0; j < i; ) {
					userEarnings[_address].pop();
					unchecked {
						j++;
					}
				}
			}
			bal.earned = sumEarned;
		}

		// Update values
		bal.total = bal.total - amount - penaltyAmount;

		_withdrawTokens(_address, amount, penaltyAmount, burnAmount, false);
	}

	/**
	 * @notice Returns withdrawable balance at exact unlock time
	 * @param user address for withdraw
	 * @param unlockTime exact unlock time
	 * @return amount total withdrawable amount
	 * @return penaltyAmount penalty amount
	 * @return burnAmount amount to burn
	 * @return index of earning
	 */
	function ieeWithdrawableBalance(
		address user,
		uint256 unlockTime
	) internal view returns (uint256 amount, uint256 penaltyAmount, uint256 burnAmount, uint256 index) {
		uint256 length = userEarnings[user].length;
		for (index; index < length; ) {
			if (userEarnings[user][index].unlockTime == unlockTime) {
				(amount, , penaltyAmount, burnAmount) = _penaltyInfo(userEarnings[user][index]);
				return (amount, penaltyAmount, burnAmount, index);
			}
			unchecked {
				index++;
			}
		}
		revert UnlockTimeNotFound();
	}

	/**
	 * @notice Withdraw individual unlocked balance and earnings, optionally claim pending rewards.
	 * @param claimRewards true to claim rewards when exit
	 * @param unlockTime of earning
	 */
	function individualEarlyExit(bool claimRewards, uint256 unlockTime) external {
		address onBehalfOf = msg.sender;
		if (unlockTime <= block.timestamp) revert InvalidTime();
		(uint256 amount, uint256 penaltyAmount, uint256 burnAmount, uint256 index) = ieeWithdrawableBalance(
			onBehalfOf,
			unlockTime
		);

		uint256 length = userEarnings[onBehalfOf].length;
		for (uint256 i = index + 1; i < length; ) {
			userEarnings[onBehalfOf][i - 1] = userEarnings[onBehalfOf][i];
			unchecked {
				i++;
			}
		}
		userEarnings[onBehalfOf].pop();

		Balances storage bal = balances[onBehalfOf];
		bal.total = bal.total - amount - penaltyAmount;
		bal.earned = bal.earned - amount - penaltyAmount;

		_withdrawTokens(onBehalfOf, amount, penaltyAmount, burnAmount, claimRewards);
	}

	/**
	 * @notice Withdraw full unlocked balance and earnings, optionally claim pending rewards.
	 * @param claimRewards true to claim rewards when exit
	 */
	function exit(bool claimRewards) external {
		address onBehalfOf = msg.sender;
		(uint256 amount, uint256 penaltyAmount, uint256 burnAmount) = withdrawableBalance(onBehalfOf);

		delete userEarnings[onBehalfOf];

		Balances storage bal = balances[onBehalfOf];
		bal.total = bal.total - bal.unlocked - bal.earned;

		_withdrawTokens(onBehalfOf, amount, penaltyAmount, burnAmount, claimRewards);
	}

	/**
	 * @notice Claim all pending staking rewards.
	 * @param _rewardTokens array of reward tokens
	 */
	function getReward(address[] memory _rewardTokens) public {
		_updateReward(msg.sender);
		_getReward(msg.sender, _rewardTokens);
		IPriceProvider(_priceProvider).update();
	}

	/**
	 * @notice Claim all pending staking rewards.
	 */
	function getAllRewards() external {
		return getReward(rewardTokens);
	}

	/**
	 * @notice Calculate earnings.
	 * @param _user address of earning owner
	 * @param _rewardToken address
	 * @param _balance of the user
	 * @param _currentRewardPerToken current RPT
	 * @return earnings amount
	 */
	function _earned(
		address _user,
		address _rewardToken,
		uint256 _balance,
		uint256 _currentRewardPerToken
	) internal view returns (uint256 earnings) {
		earnings = rewards[_user][_rewardToken];
		uint256 realRPT = _currentRewardPerToken - userRewardPerTokenPaid[_user][_rewardToken];
		earnings = earnings + (_balance * realRPT / 1e18);
	}

	/**
	 * @notice Update user reward info.
	 * @param account address
	 */
	function _updateReward(address account) internal {
		uint256 balance = balances[account].lockedWithMultiplier;
		uint256 length = rewardTokens.length;
		for (uint256 i = 0; i < length; ) {
			address token = rewardTokens[i];
			uint256 rpt = rewardPerToken(token);

			Reward storage r = rewardData[token];
			r.rewardPerTokenStored = rpt;
			r.lastUpdateTime = lastTimeRewardApplicable(token);

			if (account != address(this)) {
				rewards[account][token] = _earned(account, token, balance, rpt);
				userRewardPerTokenPaid[account][token] = rpt;
			}
			unchecked {
				i++;
			}
		}
	}

	/**
	 * @notice Add new reward.
	 * @dev If prev reward period is not done, then it resets `rewardPerSecond` and restarts period
	 * @param _rewardToken address
	 * @param reward amount
	 */
	function _notifyReward(address _rewardToken, uint256 reward) internal {
		Reward storage r = rewardData[_rewardToken];
		if (block.timestamp >= r.periodFinish) {
			r.rewardPerSecond = reward * 1e12 / rewardsDuration;
		} else {
			uint256 remaining = r.periodFinish - block.timestamp;
			uint256 leftover = remaining * r.rewardPerSecond / 1e12;
			r.rewardPerSecond = (reward + leftover) * 1e12 / rewardsDuration;
		}

		r.lastUpdateTime = block.timestamp;
		r.periodFinish = block.timestamp + rewardsDuration;
		r.balance = r.balance + reward;
	}

	/**
	 * @notice Notify unseen rewards.
	 * @dev for rewards other than RDNT token, every 24 hours we check if new
	 *  rewards were sent to the contract or accrued via aToken interest.
	 * @param token address
	 */
	function _notifyUnseenReward(address token) internal {
		if (token == address(0)) revert AddressZero();
		if (token == address(rdntToken)) {
			return;
		}
		Reward storage r = rewardData[token];
		uint256 periodFinish = r.periodFinish;
		if (periodFinish == 0) revert InvalidPeriod();
		if (periodFinish < block.timestamp + rewardsDuration - rewardsLookback) {
			uint256 unseen = IERC20(token).balanceOf(address(this)) - r.balance;
			if (unseen > 0) {
				_notifyReward(token, unseen);
			}
		}
	}

	/**
	 * @notice Hook to be called on upgrade.
	 */
	function onUpgrade() public {}

	/**
	 * @notice Sets the lookback period
	 * @param _lookback in seconds
	 */
	function setLookback(uint256 _lookback) external onlyOwner {
		rewardsLookback = _lookback;
	}

	/**
	 * @notice User gets reward
	 * @param _user address
	 * @param _rewardTokens array of reward tokens
	 */
	function _getReward(address _user, address[] memory _rewardTokens) internal whenNotPaused {
		middleFeeDistribution.forwardReward(_rewardTokens);
		uint256 length = _rewardTokens.length;
		for (uint256 i; i < length; ) {
			address token = _rewardTokens[i];
			_notifyUnseenReward(token);
			uint256 reward = rewards[_user][token] / 1e12;
			if (reward > 0) {
				rewards[_user][token] = 0;
				rewardData[token].balance = rewardData[token].balance - reward;

				IERC20(token).safeTransfer(_user, reward);
				emit RewardPaid(_user, token, reward);
			}
			unchecked {
				i++;
			}
		}
	}

	/**
	 * @notice Withdraw tokens from MFD
	 * @param onBehalfOf address to withdraw
	 * @param amount of withdraw
	 * @param penaltyAmount penalty applied amount
	 * @param burnAmount amount to burn
	 * @param claimRewards option to claim rewards
	 */
	function _withdrawTokens(
		address onBehalfOf,
		uint256 amount,
		uint256 penaltyAmount,
		uint256 burnAmount,
		bool claimRewards
	) internal {
		if (onBehalfOf != msg.sender) revert InsufficientPermission();
		_updateReward(onBehalfOf);

		rdntToken.safeTransfer(onBehalfOf, amount);
		if (penaltyAmount > 0) {
			if (burnAmount > 0) {
				rdntToken.safeTransfer(starfleetTreasury, burnAmount);
			}
			rdntToken.safeTransfer(daoTreasury, penaltyAmount - burnAmount);
		}

		if (claimRewards) {
			_getReward(onBehalfOf, rewardTokens);
			lastClaimTime[onBehalfOf] = block.timestamp;
		}

		IPriceProvider(_priceProvider).update();

		emit Withdrawn(onBehalfOf, amount, balances[onBehalfOf].locked, penaltyAmount, burnAmount, false);
	}

	/********************** Eligibility + Disqualification ***********************/

	/**
	 * @notice Withdraw all lockings tokens where the unlock time has passed
	 * @param user address
	 * @param totalLock total lock amount
	 * @param totalLockWithMultiplier total lock amount that is multiplied
	 * @param limit limit for looping operation
	 * @return lockAmount withdrawable lock amount
	 * @return lockAmountWithMultiplier withdraw amount with multiplier
	 */
	function _cleanWithdrawableLocks(
		address user,
		uint256 totalLock,
		uint256 totalLockWithMultiplier,
		uint256 limit
	) internal returns (uint256 lockAmount, uint256 lockAmountWithMultiplier) {
		LockedBalance[] storage locks = userLocks[user];

		if (locks.length != 0) {
			uint256 length = locks.length <= limit ? locks.length : limit;
			uint256 i;
			while (i < length && locks[i].unlockTime <= block.timestamp) {
				lockAmount = lockAmount + locks[i].amount;
				lockAmountWithMultiplier = lockAmountWithMultiplier + (locks[i].amount * locks[i].multiplier);
				i = i + 1;
			}
			uint256 locksLength = locks.length;
			for (uint256 j = i; j < locksLength; ) {
				locks[j - i] = locks[j];
				unchecked {
					j++;
				}
			}
			for (uint256 j = 0; j < i; ) {
				locks.pop();
				unchecked {
					j++;
				}
			}
			if (locks.length == 0) {
				userlist.removeFromList(user);
			}
		}
	}

	/**
	 * @notice Withdraw all currently locked tokens where the unlock time has passed.
	 * @param _address of the user.
	 * @param isRelockAction true if withdraw with relock
	 * @param doTransfer true to transfer tokens to user
	 * @param limit limit for looping operation
	 * @return amount for withdraw
	 */
	function _withdrawExpiredLocksFor(
		address _address,
		bool isRelockAction,
		bool doTransfer,
		uint256 limit
	) internal whenNotPaused returns (uint256 amount) {
		if (isRelockAction && _address != msg.sender && lockZap != msg.sender) revert InsufficientPermission();
		_updateReward(_address);

		uint256 amountWithMultiplier;
		Balances storage bal = balances[_address];
		(amount, amountWithMultiplier) = _cleanWithdrawableLocks(_address, bal.locked, bal.lockedWithMultiplier, limit);
		bal.locked = bal.locked - amount;
		bal.lockedWithMultiplier = bal.lockedWithMultiplier - amountWithMultiplier;
		bal.total = bal.total - amount;
		lockedSupply = lockedSupply - amount;
		lockedSupplyWithMultiplier = lockedSupplyWithMultiplier - amountWithMultiplier;

		if (!isRelockAction && !autoRelockDisabled[_address]) {
			_stake(amount, _address, defaultLockIndex[_address], true);
		} else {
			if (doTransfer) {
				IERC20(stakingToken).safeTransfer(_address, amount);
				incentivesController.afterLockUpdate(_address);
				emit Withdrawn(_address, amount, balances[_address].locked, 0, 0, stakingToken != address(rdntToken));
			}
		}
		return amount;
	}

	/**
	 * @notice Withdraw all currently locked tokens where the unlock time has passed.
	 * @param _address of the user
	 * @return withdraw amount
	 */
	function withdrawExpiredLocksFor(address _address) external returns (uint256) {
		return _withdrawExpiredLocksFor(_address, false, true, userLocks[_address].length);
	}

	/**
	 * @notice Withdraw expired locks with options
	 * @param _address for withdraw
	 * @param _limit of lock length for withdraw
	 * @param _ignoreRelock option to ignore relock
	 * @return withdraw amount
	 */
	function withdrawExpiredLocksForWithOptions(
		address _address,
		uint256 _limit,
		bool _ignoreRelock
	) external returns (uint256) {
		if (_limit == 0) _limit = userLocks[_address].length;

		return _withdrawExpiredLocksFor(_address, _ignoreRelock, true, _limit);
	}

	/**
	 * @notice Zap vesting RDNT tokens to LP
	 * @param _user address
	 * @return zapped amount
	 */
	function zapVestingToLp(address _user) external returns (uint256 zapped) {
		if (msg.sender != lockZap) revert InsufficientPermission();

		_updateReward(_user);

		LockedBalance[] storage earnings = userEarnings[_user];
		for (uint256 i = earnings.length; i > 0; ) {
			if (earnings[i - 1].unlockTime > block.timestamp) {
				zapped = zapped + earnings[i - 1].amount;
				earnings.pop();
			} else {
				break;
			}
			unchecked {
				i--;
			}
		}

		rdntToken.safeTransfer(lockZap, zapped);

		Balances storage bal = balances[_user];
		bal.earned = bal.earned - zapped;
		bal.total = bal.total - zapped;

		IPriceProvider(_priceProvider).update();

		return zapped;
	}

	/**
	 * @notice Returns price provider address
	 */
	function getPriceProvider() external view returns (address) {
		return _priceProvider;
	}

	/**
	 * @notice Claims bounty.
	 * @dev Remove expired locks
	 * @param _user address
	 * @param _execute true if this is actual execution
	 * @return issueBaseBounty true if needs to issue base bounty
	 */
	function claimBounty(address _user, bool _execute) public whenNotPaused returns (bool issueBaseBounty) {
		if (msg.sender != address(bountyManager)) revert InsufficientPermission();

		(, uint256 unlockable, , , ) = lockedBalances(_user);
		if (unlockable == 0) {
			return (false);
		} else {
			issueBaseBounty = true;
		}

		if (!_execute) {
			return (issueBaseBounty);
		}
		// Withdraw the user's expried locks
		_withdrawExpiredLocksFor(_user, false, true, userLocks[_user].length);
	}

	/**
	 * @notice Pause MFD functionalities
	 */
	function pause() public onlyOwner {
		_pause();
	}

	/**
	 * @notice Resume MFD functionalities
	 */
	function unpause() public onlyOwner {
		_unpause();
	}

	/**
	 * @notice Requalify user for reward elgibility
	 * @param _user address
	 */
	function requalifyFor(address _user) public {
		incentivesController.afterLockUpdate(_user);
	}

	/**
	 * @notice Requalify user
	 */
	function requalify() external {
		requalifyFor(msg.sender);
	}

	/**
	 * @notice Added to support recovering LP Rewards from other systems such as BAL to be distributed to holders.
	 * @param tokenAddress to recover.
	 * @param tokenAmount to recover.
	 */
	function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
		if (rewardData[tokenAddress].lastUpdateTime != 0) revert ActiveReward();
		IERC20(tokenAddress).safeTransfer(owner(), tokenAmount);
		emit Recovered(tokenAddress, tokenAmount);
	}
}
