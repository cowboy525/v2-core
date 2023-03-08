// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "../../interfaces/IMultiFeeDistribution.sol";
import "../../interfaces/IEligibilityDataProvider.sol";
import "../../interfaces/IOnwardIncentivesController.sol";
import "../../interfaces/IAToken.sol";
import "../../interfaces/IMiddleFeeDistribution.sol";
import "../../interfaces/IBounty.sol";

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../dependencies/openzeppelin/upgradeability/Initializable.sol";
import "../../dependencies/openzeppelin/upgradeability/OwnableUpgradeable.sol";
import "../../dependencies/openzeppelin/upgradeability/PausableUpgradeable.sol";

// based on the Sushi MasterChef
// https://github.com/sushiswap/sushiswap/blob/master/contracts/MasterChef.sol
contract ChefIncentivesController is Initializable, PausableUpgradeable, OwnableUpgradeable {
	using SafeMath for uint256;
	using SafeERC20 for IERC20;

	// Info of each user.
	// reward = user.`amount` * pool.`accRewardPerShare` - `rewardDebt`
	struct UserInfo {
		uint256 amount;
		uint256 rewardDebt;
		uint256 enterTime;
		uint256 lastClaimTime;
	}

	// Info of each pool.
	struct PoolInfo {
		uint256 totalSupply;
		uint256 allocPoint; // How many allocation points assigned to this pool.
		uint256 lastRewardTime; // Last second that reward distribution occurs.
		uint256 accRewardPerShare; // Accumulated rewards per share, times ACC_REWARD_PRECISION. See below.
		IOnwardIncentivesController onwardIncentives;
	}

	// Info about token emissions for a given time period.
	struct EmissionPoint {
		uint128 startTimeOffset;
		uint128 rewardsPerSecond;
	}

	// Emitted when rewardPerSecond is updated
	event RewardsPerSecondUpdated(uint256 indexed rewardsPerSecond, bool persist);

	event BalanceUpdated(address indexed token, address indexed user, uint256 balance, uint256 totalSupply);

	event EmissionScheduleAppended(uint256[] startTimeOffsets, uint256[] rewardsPerSeconds);

	event ChefReserveLow(uint256 _balance);

	event ChefReserveEmpty(uint256 _balance);

	event Disqualified(address indexed user, uint256 rewardsRemoved);

	// multiplier for reward calc
	uint256 private constant ACC_REWARD_PRECISION = 1e12;

	// Data about the future reward rates. emissionSchedule stored in chronological order,
	// whenever the number of blocks since the start block exceeds the next block offset a new
	// reward rate is applied.
	EmissionPoint[] public emissionSchedule;

	// If true, keep this new reward rate indefinitely
	// If false, keep this reward rate until the next scheduled block offset, then return to the schedule.
	bool public persistRewardsPerSecond;

	/********************** Emission Info ***********************/

	// Array of tokens for reward
	address[] public registeredTokens;

	// Current reward per second
	uint256 public rewardsPerSecond;

	// last RPS, used during refill after reserve empty
	uint256 public lastRPS;

	// Index in emission schedule which the last rewardsPerSeconds was used
	// only used for scheduled rewards
	uint256 public emissionScheduleIndex;

	// Info of each pool.
	mapping(address => PoolInfo) public poolInfo;
	mapping(address => bool) private validRTokens;

	// Total allocation poitns. Must be the sum of all allocation points in all pools.
	uint256 public totalAllocPoint;

	// token => user => Info of each user that stakes LP tokens.
	mapping(address => mapping(address => UserInfo)) public userInfo;

	// user => base claimable balance
	mapping(address => uint256) public userBaseClaimable;

	// MFD, LPMFD, bounties, AC, middlefee
	mapping(address => bool) public eligibilityExempt;

	// The block number when reward mining starts.
	uint256 public startTime;

	bool public ELIGIBILITY_ENABLED;

	address public poolConfigurator;
	uint256 public depositedRewards;
	uint256 public accountedRewards;
	uint256 public lastAllPoolUpdate;

	IMiddleFeeDistribution public rewardMinter;
	IEligibilityDataProvider public eligibleDataProvider;
	address public bountyManager;

	function initialize(
		address _poolConfigurator,
		IEligibilityDataProvider _eligibleDataProvider,
		IMiddleFeeDistribution _rewardMinter,
		uint256 _rewardsPerSecond
	) public initializer {
		require(address(_poolConfigurator) != address(0));
		require(address(_eligibleDataProvider) != address(0));
		require(address(_rewardMinter) != address(0));

		__Ownable_init();
		__Pausable_init();

		poolConfigurator = _poolConfigurator;
		eligibleDataProvider = _eligibleDataProvider;
		rewardMinter = _rewardMinter;
		rewardsPerSecond = _rewardsPerSecond;
		persistRewardsPerSecond = true;

		ELIGIBILITY_ENABLED = true;
	}

	function poolLength() external view returns (uint256) {
		return registeredTokens.length;
	}

	function _getMfd() internal view returns (IMultiFeeDistribution mfd) {
		address multiFeeDistribution = rewardMinter.getMultiFeeDistributionAddress();
		mfd = IMultiFeeDistribution(multiFeeDistribution);
	}

	function _getLpMfd() internal view returns (IMultiFeeDistribution mfd) {
		address multiFeeDistribution = rewardMinter.getLPFeeDistributionAddress();
		mfd = IMultiFeeDistribution(multiFeeDistribution);
	}

	function setOnwardIncentives(address _token, IOnwardIncentivesController _incentives) external onlyOwner {
		require(poolInfo[_token].lastRewardTime != 0, "pool doesn't exist");
		poolInfo[_token].onwardIncentives = _incentives;
	}

	function setBountyManager(address _bountyManager) external onlyOwner {
		bountyManager = _bountyManager;
	}

	function setEligibilityEnabled(bool _newVal) external onlyOwner {
		ELIGIBILITY_ENABLED = _newVal;
	}

	/********************** Pool Setup + Admin ***********************/

	function start() public onlyOwner {
		require(startTime == 0, "already started");
		startTime = block.timestamp;
	}

	// Add a new lp to the pool. Can only be called by the poolConfigurator.
	function addPool(address _token, uint256 _allocPoint) external {
		require(msg.sender == poolConfigurator, "not allowed");
		require(poolInfo[_token].lastRewardTime == 0, "pool already exists");
		_updateEmissions();
		totalAllocPoint = totalAllocPoint.add(_allocPoint);
		registeredTokens.push(_token);
		poolInfo[_token] = PoolInfo({
			totalSupply: 0,
			allocPoint: _allocPoint,
			lastRewardTime: block.timestamp,
			accRewardPerShare: 0,
			onwardIncentives: IOnwardIncentivesController(address(0))
		});
		validRTokens[_token] = true;
	}

	// Update the given pool's allocation point. Can only be called by the owner.
	function batchUpdateAllocPoint(address[] calldata _tokens, uint256[] calldata _allocPoints) public onlyOwner {
		require(_tokens.length == _allocPoints.length, "params length mismatch");
		_massUpdatePools();
		uint256 _totalAllocPoint = totalAllocPoint;
		for (uint256 i = 0; i < _tokens.length; i++) {
			PoolInfo storage pool = poolInfo[_tokens[i]];
			require(pool.lastRewardTime > 0, "pool doesn't exist");
			_totalAllocPoint = _totalAllocPoint.sub(pool.allocPoint).add(_allocPoints[i]);
			pool.allocPoint = _allocPoints[i];
		}
		totalAllocPoint = _totalAllocPoint;
	}

	/**
	 * @notice Sets the reward per second to be distributed. Can only be called by the owner.
	 * @dev Its decimals count is ACC_REWARD_PRECISION
	 * @param _rewardsPerSecond The amount of reward to be distributed per second.
	 */
	function setRewardsPerSecond(uint256 _rewardsPerSecond, bool _persist) external onlyOwner {
		_massUpdatePools();
		rewardsPerSecond = _rewardsPerSecond;
		persistRewardsPerSecond = _persist;
		emit RewardsPerSecondUpdated(_rewardsPerSecond, _persist);
	}

	function setScheduledRewardsPerSecond() internal {
		if (!persistRewardsPerSecond) {
			uint256 length = emissionSchedule.length;
			uint256 i = emissionScheduleIndex;
			uint128 offset = uint128(block.timestamp.sub(startTime));
			for (; i < length && offset >= emissionSchedule[i].startTimeOffset; i++) {}
			if (i > emissionScheduleIndex) {
				emissionScheduleIndex = i;
				_massUpdatePools();
				rewardsPerSecond = uint256(emissionSchedule[i - 1].rewardsPerSecond);
			}
		}
	}

	function setEmissionSchedule(uint256[] calldata _startTimeOffsets, uint256[] calldata _rewardsPerSecond)
		external
		onlyOwner
	{
		uint256 length = _startTimeOffsets.length;
		require(length > 0 && length == _rewardsPerSecond.length, "empty or mismatch params");

		for (uint256 i = 0; i < length; i++) {
			require(_startTimeOffsets[i] <= type(uint128).max, "startTimeOffsets > max uint128");
			require(_rewardsPerSecond[i] <= type(uint128).max, "rewardsPerSecond > max uint128");

			if (startTime > 0) {
				require(_startTimeOffsets[i] > block.timestamp.sub(startTime), "invalid start time");
			}
			emissionSchedule.push(
				EmissionPoint({
					startTimeOffset: uint128(_startTimeOffsets[i]),
					rewardsPerSecond: uint128(_rewardsPerSecond[i])
				})
			);
		}
		emit EmissionScheduleAppended(_startTimeOffsets, _rewardsPerSecond);
	}

	function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
		IERC20(tokenAddress).safeTransfer(owner(), tokenAmount);
	}

	/********************** Pool State Changers ***********************/

	function _updateEmissions() internal {
		if (block.timestamp > endRewardTime()) {
			_massUpdatePools();
			lastRPS = rewardsPerSecond;
			rewardsPerSecond = 0;
			return;
		}
		setScheduledRewardsPerSecond();
	}

	// Update reward variables for all pools
	function _massUpdatePools() internal {
		uint256 totalAP = totalAllocPoint;
		uint256 length = registeredTokens.length;
		for (uint256 i = 0; i < length; ++i) {
			_updatePool(poolInfo[registeredTokens[i]], totalAP);
		}
		lastAllPoolUpdate = block.timestamp;
	}

	// Update reward variables of the given pool to be up-to-date.
	function _updatePool(PoolInfo storage pool, uint256 _totalAllocPoint) internal {
		uint256 timestamp = block.timestamp;
		if (endRewardTime() <= block.timestamp) {
			timestamp = endRewardTime();
		}
		if (timestamp <= pool.lastRewardTime) {
			return;
		}

		uint256 lpSupply = pool.totalSupply;
		if (lpSupply == 0) {
			pool.lastRewardTime = timestamp;
			return;
		}

		uint256 duration = timestamp.sub(pool.lastRewardTime);
		uint256 rawReward = duration.mul(rewardsPerSecond);
		if (availableRewards() < rawReward) {
			rawReward = availableRewards();
		}
		uint256 reward = rawReward.mul(pool.allocPoint).div(_totalAllocPoint);
		accountedRewards = accountedRewards.add(reward);
		pool.accRewardPerShare = pool.accRewardPerShare.add(reward.mul(ACC_REWARD_PRECISION).div(lpSupply));
		pool.lastRewardTime = timestamp;
	}

	/********************** Emission Calc + Transfer ***********************/

	function pendingRewards(address _user, address[] memory _tokens) public view returns (uint256[] memory) {
		uint256[] memory claimable = new uint256[](_tokens.length);
		for (uint256 i = 0; i < _tokens.length; i++) {
			address token = _tokens[i];
			PoolInfo storage pool = poolInfo[token];
			UserInfo storage user = userInfo[token][_user];
			uint256 accRewardPerShare = pool.accRewardPerShare;
			uint256 lpSupply = pool.totalSupply;
			if (block.timestamp > pool.lastRewardTime && lpSupply != 0) {
				uint256 duration = block.timestamp.sub(pool.lastRewardTime);
				uint256 reward = duration.mul(rewardsPerSecond).mul(pool.allocPoint).div(totalAllocPoint);
				accRewardPerShare = accRewardPerShare.add(reward.mul(ACC_REWARD_PRECISION).div(lpSupply));
			}
			claimable[i] = user.amount.mul(accRewardPerShare).div(ACC_REWARD_PRECISION).sub(user.rewardDebt);
		}
		return claimable;
	}

	// Claim pending rewards for one or more pools.
	// Rewards are not received directly, they are minted by the rewardMinter.
	function claim(address _user, address[] memory _tokens) public {
		if (ELIGIBILITY_ENABLED) {
			checkAndProcessEligibility(_user);
		}

		_updateEmissions();

		uint256 pending = userBaseClaimable[_user];
		userBaseClaimable[_user] = 0;
		uint256 _totalAllocPoint = totalAllocPoint;
		for (uint256 i = 0; i < _tokens.length; i++) {
			require(validRTokens[_tokens[i]]);
			PoolInfo storage pool = poolInfo[_tokens[i]];
			require(pool.lastRewardTime > 0, "pool doesn't exist");
			_updatePool(pool, _totalAllocPoint);
			UserInfo storage user = userInfo[_tokens[i]][_user];
			uint256 rewardDebt = user.amount.mul(pool.accRewardPerShare).div(ACC_REWARD_PRECISION);
			pending = pending.add(rewardDebt.sub(user.rewardDebt));
			user.rewardDebt = rewardDebt;
			user.lastClaimTime = block.timestamp;
		}

		_mint(_user, pending);

		if (endRewardTime() < block.timestamp + 5 days) {
			_emitReserveLow();
		}
	}

	function _emitReserveLow() internal {
		address rdntToken = rewardMinter.getRdntTokenAddress();
		emit ChefReserveLow(IERC20(rdntToken).balanceOf(address(this)));
	}

	function _mint(address _user, uint256 _amount) internal {
		_amount = _sendRadiant(address(_getMfd()), _amount);
		_getMfd().mint(_user, _amount, true);
	}

	function setEligibilityExempt(address _contract) public onlyOwner {
		eligibilityExempt[_contract] = true;
	}

	/********************** Eligibility + Disqualification ***********************/

	/**
	 * @notice `after` Hook for deposit and borrow update.
	 * @dev important! eligible status can be updated here
	 */
	function handleActionAfter(
		address _user,
		uint256 _balance,
		uint256 _totalSupply
	) external {
		require(validRTokens[msg.sender] || msg.sender == address(_getLpMfd()), "!rToken || lpmfd");

		if (
			_user == address(rewardMinter) ||
			_user == address(_getMfd()) ||
			_user == address(_getLpMfd()) ||
			eligibilityExempt[_user]
		) {
			return;
		}
		if (ELIGIBILITY_ENABLED) {
			eligibleDataProvider.refresh(_user);
			if (eligibleDataProvider.isEligibleForRewards(_user)) {
				_handleActionAfterForToken(msg.sender, _user, _balance, _totalSupply);
			} else {
				checkAndProcessEligibility(_user);
			}
		} else {
			_handleActionAfterForToken(msg.sender, _user, _balance, _totalSupply);
		}
	}

	function _handleActionAfterForToken(
		address _token,
		address _user,
		uint256 _balance,
		uint256 _totalSupply
	) internal {
		PoolInfo storage pool = poolInfo[_token];
		require(pool.lastRewardTime > 0, "pool doesn't exist");
		_updateEmissions();
		_updatePool(pool, totalAllocPoint);
		UserInfo storage user = userInfo[_token][_user];
		uint256 amount = user.amount;
		uint256 accRewardPerShare = pool.accRewardPerShare;
		if (amount != 0) {
			uint256 pending = amount.mul(accRewardPerShare).div(ACC_REWARD_PRECISION).sub(user.rewardDebt);
			if (pending != 0) {
				userBaseClaimable[_user] = userBaseClaimable[_user].add(pending);
			}
		}
		pool.totalSupply = pool.totalSupply.sub(user.amount);
		user.amount = _balance;
		user.rewardDebt = _balance.mul(accRewardPerShare).div(ACC_REWARD_PRECISION);
		if (user.amount > 0) {
			user.enterTime = block.timestamp;
		}
		pool.totalSupply = pool.totalSupply.add(_balance);
		if (pool.onwardIncentives != IOnwardIncentivesController(address(0))) {
			pool.onwardIncentives.handleAction(_token, _user, _balance, _totalSupply);
		}

		emit BalanceUpdated(_token, _user, _balance, _totalSupply);
	}

	/**
	 * @notice `before` Hook for deposit and borrow update.
	 */
	function handleActionBefore(address _user) external {}

	/**
	 * @notice Hook for lock update.
	 * @dev Called by the locking contracts before locking or unlocking happens
	 */
	function beforeLockUpdate(address _user) external {
		require(msg.sender == address(_getLpMfd()) || msg.sender == address(_getMfd()));
		if (ELIGIBILITY_ENABLED) {
			uint256 userBounty = bountyForUser(_user);
			bool isRelock = !_getLpMfd().autoRelockDisabled(_user);
			if (userBounty != 0 && !isRelock) {
				checkAndProcessEligibility(_user);
			}
		}
	}

	/**
	 * @notice Hook for lock update.
	 * @dev Called by the locking contracts after locking or unlocking happens
	 */
	function afterLockUpdate(address _user) external {
		require(msg.sender == address(_getLpMfd()) || msg.sender == address(_getMfd()), "!lpMFD || !MFD");

		if (ELIGIBILITY_ENABLED) {
			eligibleDataProvider.updatePrice();
			if (eligibleDataProvider.isEligibleForRewards(_user)) {
				for (uint256 i = 0; i < registeredTokens.length; i++) {
					uint256 newBal = IERC20(registeredTokens[i]).balanceOf(_user);
					if (newBal != 0) {
						_handleActionAfterForToken(
							registeredTokens[i],
							_user,
							newBal,
							poolInfo[registeredTokens[i]].totalSupply.add(newBal).sub(
								userInfo[registeredTokens[i]][_user].amount
							)
						);
					}
				}
			}
			eligibleDataProvider.refresh(_user);
		}
	}

	/********************** Eligibility + Disqualification ***********************/

	function earnedSince(address _user, uint256 lastEligibleTime) public view returns (uint256 earnedAmount) {
		if (!ELIGIBILITY_ENABLED || eligibleDataProvider.isEligibleForRewards(_user)) {
			return 0;
		}

		uint256 ineligibleDuration;
		if (lastEligibleTime < block.timestamp) {
			ineligibleDuration = block.timestamp.sub(lastEligibleTime);
		}

		uint256[] memory claimable = pendingRewards(_user, registeredTokens);
		for (uint256 i = 0; i < claimable.length; i++) {
			UserInfo storage user = userInfo[registeredTokens[i]][_user];
			uint256 referenceTime;

			if (user.lastClaimTime > user.enterTime) {
				referenceTime = user.lastClaimTime;
			} else {
				referenceTime = user.enterTime;
			}

			uint256 referenceDuration = block.timestamp - referenceTime;
			if (referenceDuration > 0) {
				uint256 rps = claimable[i].div(referenceDuration);
				uint256 ineligAmt = ineligibleDuration.mul(rps);
				if (ineligAmt > claimable[i]) {
					ineligAmt = claimable[i];
				}
				earnedAmount = earnedAmount.add(ineligAmt);
			}
		}
	}

	function bountyForUser(address _user) public view returns (uint256 bounty) {
		bounty = earnedSince(_user, eligibleDataProvider.lastEligibleTime(_user));
	}

	function harvestIneligible(address _target, uint256 _bounty) internal returns (uint256) {
		require(ELIGIBILITY_ENABLED, "!EE");
		claimToBase(_target, registeredTokens);
		if (_bounty < userBaseClaimable[_target]) {
			userBaseClaimable[_target] = userBaseClaimable[_target].sub(_bounty);
		} else {
			_bounty = userBaseClaimable[_target];
			userBaseClaimable[_target] = 0;
		}
		return _bounty;
	}

	function hasEligibleDeposits(address _user) internal view returns (bool hasDeposits) {
		for (uint256 i = 0; i < registeredTokens.length; i++) {
			UserInfo storage user = userInfo[registeredTokens[i]][_user];
			if (user.amount != 0) {
				hasDeposits = true;
				break;
			}
		}
	}

	function checkAndProcessEligibility(address _user, bool _execute)
		internal
		returns (uint256 bountyAmt, bool issueBaseBounty)
	{
		// for expire DQ
		bool hasRelock = !_getLpMfd().autoRelockDisabled(_user);
		bool isMarketDq = eligibleDataProvider.isMarketDisqualified(_user);
		bool isEligible = eligibleDataProvider.isEligibleForRewards(_user);
		uint256 lastEligibleTime = eligibleDataProvider.lastEligibleTime(_user);
		uint256 lastDqTime = eligibleDataProvider.getDqTime(_user);
		bool hasEligDeposits = hasEligibleDeposits(_user);
		bool alreadyDqd = lastDqTime != 0;

		// market dq:
		//    stop all types immediately, BB
		// timedq:
		//    if !relock, remove inelig
		//    if relock, no-op
		if (!isEligible && !alreadyDqd) {
			// inelig earned emissions
			if (isMarketDq && hasEligDeposits) {
				// all user types DQ when market, will DQ below if _execute
				issueBaseBounty = true;
			} else {
				// expired dq
				if (lastEligibleTime != 0 && lastEligibleTime < block.timestamp) {
					if (!hasRelock) {
						bountyAmt = bountyForUser(_user);
					}
				}
			}
		}
		if (_execute) {
			if (bountyAmt != 0 || issueBaseBounty) {
				require(!isEligible, "user still eligible");
				stopEmissionsFor(_user);
			}

			if (bountyAmt != 0) {
				uint256 rewardsRemoved = harvestIneligible(_user, bountyAmt);
				emit Disqualified(_user, rewardsRemoved);
			}
			eligibleDataProvider.refresh(_user);
		}
	}

	function checkAndProcessEligibility(address _user) internal {
		checkAndProcessEligibility(_user, true);
	}

	function claimBounty(address _user, bool _execute) public returns (uint256 bountyAmt, bool issueBaseBounty) {
		require(msg.sender == address(bountyManager), "bounty only");
		(bountyAmt, issueBaseBounty) = checkAndProcessEligibility(_user, _execute);
		if (_execute) {
			address rdntAddr = rewardMinter.getRdntTokenAddress();
			IERC20(rdntAddr).safeApprove(address(bountyManager), bountyAmt);
		}
	}

	function stopEmissionsFor(address _user) internal {
		require(ELIGIBILITY_ENABLED, "!EE");
		require(!eligibleDataProvider.isEligibleForRewards(_user), "user is still eligible");
		uint256 length = registeredTokens.length;
		for (uint256 i = 0; i < length; ++i) {
			address token = registeredTokens[i];
			PoolInfo storage pool = poolInfo[token];
			UserInfo storage user = userInfo[token][_user];

			_handleActionAfterForToken(token, _user, 0, pool.totalSupply.sub(user.amount));
		}
		eligibleDataProvider.setDqTime(_user, block.timestamp);
	}

	function _sendRadiant(address _user, uint256 _amount) internal returns (uint256) {
		if (_amount == 0) {
			return 0;
		}

		address rdntToken = rewardMinter.getRdntTokenAddress();
		uint256 chefReserve = IERC20(rdntToken).balanceOf(address(this));
		if (_amount > chefReserve) {
			emit ChefReserveEmpty(chefReserve);
			_pause();
		} else {
			IERC20(rdntToken).safeTransfer(_user, _amount);
		}
		return _amount;
	}

	/********************** RDNT Reserve Management ***********************/

	function endRewardTime() public view returns (uint256 timestamp) {
		uint256 unclaimedRewards = depositedRewards.sub(accountedRewards);
		uint256 extra = 0;
		for (uint256 i; i < registeredTokens.length; i++) {
			if (poolInfo[registeredTokens[i]].lastRewardTime <= lastAllPoolUpdate) {
				continue;
			} else {
				extra = extra.add(
					poolInfo[registeredTokens[i]]
						.lastRewardTime
						.sub(lastAllPoolUpdate)
						.mul(poolInfo[registeredTokens[i]].allocPoint)
						.mul(rewardsPerSecond)
						.div(totalAllocPoint)
				);
			}
		}
		if (rewardsPerSecond == 0) {
			timestamp = type(uint256).max;
		} else {
			timestamp = (unclaimedRewards + extra).div(rewardsPerSecond) + (lastAllPoolUpdate);
		}
	}

	function registerRewardDeposit(uint256 _amount) external onlyOwner {
		depositedRewards = depositedRewards.add(_amount);
		_massUpdatePools();
		if (rewardsPerSecond == 0 && lastRPS > 0) {
			rewardsPerSecond = lastRPS;
		}
	}

	function availableRewards() internal view returns (uint256 amount) {
		return depositedRewards.sub(accountedRewards);
	}

	/********************** Helper/Convenience Methods ***********************/

	/**
	 * @notice Claim pending rewards for one or more pools into base claimable.
	 * @dev Rewards are not transferred, just converted into base claimable.
	 */
	function claimToBase(address _user, address[] memory _tokens) public {
		uint256 _userBaseClaimable = userBaseClaimable[_user];

		// updatePool must be called after calculation of pending rewards
		// this is because of reward calculation based on eligibility
		uint256[] memory pending = pendingRewards(_user, _tokens);
		_updateEmissions();
		uint256 _totalAllocPoint = totalAllocPoint;
		for (uint256 i = 0; i < _tokens.length; i++) {
			require(validRTokens[_tokens[i]]);
			UserInfo storage user = userInfo[_tokens[i]][_user];
			_userBaseClaimable = _userBaseClaimable.add(pending[i]);

			// Set pending reward to zero
			PoolInfo storage pool = poolInfo[_tokens[i]];
			_updatePool(pool, _totalAllocPoint);
			uint256 newDebt = user.amount.mul(pool.accRewardPerShare).div(ACC_REWARD_PRECISION);
			user.rewardDebt = newDebt;
			user.lastClaimTime = block.timestamp;
		}
		userBaseClaimable[_user] = _userBaseClaimable;
	}

	function saveUserRewards(address[] memory _users) public {
		address[] memory _tokens = registeredTokens;
		for (uint256 i = 0; i < _users.length; i++) {
			if (_users[i] != address(0)) {
				claimToBase(_users[i], _tokens);
			}
		}
	}

	function claimAll(address _user) external {
		claim(_user, registeredTokens);
	}

	function allPendingRewards(address _user) public view returns (uint256 pending) {
		pending = userBaseClaimable[_user];
		uint256[] memory claimable = pendingRewards(_user, registeredTokens);
		for (uint256 i = 0; i < claimable.length; i++) {
			pending += claimable[i];
		}
	}
}
