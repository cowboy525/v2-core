// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
pragma abicoder v2;

import "./MultiFeeDistribution.sol";
import "@uniswap/lib/contracts/interfaces/IUniswapV2Router.sol";

import "../../interfaces/ILendingPool.sol";
import "../../interfaces/IFeeDistribution.sol";
import "../../interfaces/ILockZap.sol";
import "../../interfaces/IMFDHelper.sol";

/// @title MFD Plus Bounty and Compund
/// @author Radiant
/// @dev All function calls are currently implemented without side effects
contract MFDPlus is MultiFeeDistribution {
	using SafeERC20 for IERC20;
	using SafeMath for uint256;
	using SafeERC20 for IMintableToken;

	// Option flags
	bool public BOUNTY_ENABLED;
	bool public AC_ENABLED;

	// note: relock disabled is default, autocompound default false
	mapping(address => bool) public autocompoundEnabled;
	mapping(address => uint256) public lastAutocompound;

	// Compound params
	uint256 public autocompoundThreshold;
	uint256 public autocompoundFee;
	uint256 public compoundAcceptableSlippage;

	// Contract Addresses
	address public bountyManager;
	address public baseToken; // weth
	IMFDHelper public mfdHelper;
	address public uniRouter;

	event Compounded(address indexed _user, uint256 _amount);
	event ExpiredLocksRemoved(address indexed _user, uint256 unlockable, uint256 ineligInRdnt);

	/************************ Setters ************************/

	function setCompoundOptions(
		address _baseToken,
		address _uniRouter,
		address _bountyManager,
		address _mfdHelper,
		bool _bountyEnabled,
		bool _acEnabled,
		uint256 _autocompoundThreshold,
		uint256 _autocompoundFee,
		uint256 _compoundAcceptableSlippage
	) public onlyOwner {
		require(_uniRouter != address(0));
		require(_baseToken != address(0));
		require(_bountyManager != address(0));
		require(_mfdHelper != address(0));
		require(_autocompoundThreshold != uint256(0));
		require(_autocompoundFee != uint256(0));
		require(_compoundAcceptableSlippage != uint256(0));

		uniRouter = _uniRouter;
		baseToken = _baseToken;
		bountyManager = _bountyManager;
		mfdHelper = IMFDHelper(_mfdHelper);
		autocompoundThreshold = _autocompoundThreshold; //RDNT
		autocompoundFee = _autocompoundFee; //%
		compoundAcceptableSlippage = _compoundAcceptableSlippage;
		BOUNTY_ENABLED = _bountyEnabled;
		AC_ENABLED = _acEnabled;
	}

	function setAutoCompoundAndBountiesEnabled(bool _AC_ENABLED, bool _BOUNTY_ENABLED) public onlyOwner {
		AC_ENABLED = _AC_ENABLED;
		BOUNTY_ENABLED = _BOUNTY_ENABLED;
	}

	/**
	 * @notice set autocompound status for msg.sender
	 * @param _status AC on?
	 */
	function setAutocompound(bool _status) external {
		autocompoundEnabled[msg.sender] = _status;
	}

	/************************ Execution ************************/

	/**
	 * @notice Claims bounty.
	 * @dev Remove expired locks
	 * @param _user address.
	 * @param _execute flag for actual claim.
	 */
	function claimBounty(address _user, bool _execute) public returns (uint256 bountyAmt, bool issueBaseBounty) {
		require(BOUNTY_ENABLED);
		require(msg.sender == address(bountyManager));

		if (_execute) {
			_updateReward(_user);
		}

		(, uint256 unlockable, , , ) = lockedBalances(_user);
		if (unlockable == 0) {
			return (0, false);
		}

		// If Relock is true, then issue base bounty
		if (!autoRelockDisabled[_user]) {
			issueBaseBounty = true;
		}

		if (!_execute) {
			// If relock is false, then calc bounty
			if (autoRelockDisabled[_user]) {
				bountyAmt = _wethToRdnt(
					_convertPendingRewardsToWeth(_user, bountyForUser(_user), _execute, true),
					false
				);
			}
			// If relock is true, just issue base bounty
			return (bountyAmt, issueBaseBounty);
		} else {
			// If not relock, then remove ineleig plat rev
			if (autoRelockDisabled[_user]) {
				bountyAmt = _removeIneligiblePlatRev(_user);
			}
			// Withdraw the user's expried locks
			_withdrawExpiredLocksFor(_user, false, true, userLocks[_user].length);
			emit ExpiredLocksRemoved(_user, unlockable, bountyAmt);
			rdntToken.safeApprove(address(bountyManager), bountyAmt);
		}
	}

	/**
	 * @notice Remove inelgible Platform Revenue.
	 * @param _user address.
	 */
	function _removeIneligiblePlatRev(address _user) internal returns (uint256 ineligRemovedInRdnt) {
		require(BOUNTY_ENABLED);

		IFeeDistribution.RewardData[] memory bounties = bountyForUser(_user);
		IFeeDistribution.RewardData[] memory penalties = new IFeeDistribution.RewardData[](bounties.length);

		for (uint256 i; i < bounties.length; i++) {
			address token = bounties[i].token;
			uint256 penalty = bounties[i].amount;
			uint256 reward = rewards[_user][token].div(1e12);

			// Avoid cases if reward not enough
			if (reward > penalty) {
				reward = reward.sub(penalty);
			} else {
				penalty = reward;
				reward = 0;
			}
			rewards[_user][token] = reward.mul(1e12);

			penalties[i].token = token;
			penalties[i].amount = penalty;

			//emit IneligibleRewardRemoved(_user, token, penalty);
		}

		ineligRemovedInRdnt = _wethToRdnt(_convertPendingRewardsToWeth(_user, penalties, true, false), true);
	}

	/**
	 * @notice Bounty amount of user per each reward token
	 * @dev Reward is in rTokens
	 */
	function bountyForUser(address _user) public view returns (IFeeDistribution.RewardData[] memory bounties) {
		IFeeDistribution.RewardData[] memory pending = claimableRewards(_user);
		LockedBalance[] memory locks = userLocks[_user];
		bounties = mfdHelper.getIneligibleRewards(pending, locks, lastClaimTime[_user]);
	}

	/**
	 * @notice Compound user's rewards
	 * @dev Can be auto compound or manual compound
	 * @param _user user address
	 * @param _execute whether to execute txn, or just quote (expected amount out for bounty executor and slippage)
	 */
	function claimCompound(address _user, bool _execute) public returns (uint256 tokensOut) {
		bool isAutoCompound = _user != msg.sender;

		if (isAutoCompound && !autocompoundEnabled[_user]) {
			if (_execute) {
				revert();
			} else {
				return 0;
			}
		}

		if (_execute) {
			_updateReward(_user);
		}

		uint256 pendingInRdnt = _wethToRdnt(
			_convertPendingRewardsToWeth(_user, claimableRewards(_user), false, true),
			false
		);

		// user is not eligible for AC: too low pending or too soon since last execute
		if (
			isAutoCompound &&
			(pendingInRdnt < autocompoundThreshold || block.timestamp.sub(lastAutocompound[_user]) < 1 days)
		) {
			return 0;
		}

		(uint256 wethZapped, uint256 feeInWeth) = _compoundUser(_user, isAutoCompound, _execute);

		if (isAutoCompound) {
			tokensOut = _wethToRdnt(feeInWeth, _execute);
			if (_execute) {
				rdntToken.safeApprove(address(bountyManager), tokensOut);
				lastAutocompound[_user] = block.timestamp;
			}
		} else {
			tokensOut = wethZapped;
		}
	}

	/**
	 * @notice Return expected amout our for a user to compound themself
	 * @dev has own funcs because claimBounty above doesnt handle slippage
	 */
	function quoteSelfCompound() external view returns (uint256 tokensOut) {
		tokensOut = IMFDHelper(mfdHelper).quoteSelfCompound();
	}

	/**
	 * @notice Compound msg.sender
	 * @dev has own funcs because claimBounty above doesnt handle slippage
	 * @param _quote expected amount WETH out, quoted before this txn
	 */
	function selfCompound(uint256 _quote) external returns (uint256 tokensOut) {
		require(_quote != 0);
		tokensOut = claimCompound(msg.sender, true);
		uint256 minAmountOut = _quote.sub(_quote.mul(compoundAcceptableSlippage).div(100));
		require(tokensOut >= minAmountOut);
	}

	/**
	 * @notice Compound: zap user pending rewards into locked LP
	 * @dev has own funcs because claimBounty above doesnt handle slippage
	 * @param _user address
	 * @param _takeFee whether to remove % fee from converted WETH to pay Bounty hunter
	 * @param _execute execute txn or just quote
	 */
	function _compoundUser(
		address _user,
		bool _takeFee,
		bool _execute
	) internal returns (uint256 wethZapped, uint256 feeInWeth) {
		wethZapped = _convertPendingRewardsToWeth(_user, claimableRewards(_user), _execute, true);

		if (_takeFee) {
			feeInWeth = wethZapped.mul(autocompoundFee).div(100);
			wethZapped = wethZapped.sub(feeInWeth);
		}

		if (_execute) {
			IERC20(baseToken).safeApprove(lockZap, wethZapped);
			ILockZap(lockZap).zapOnBehalf(false, wethZapped, 0, _user);
			lastClaimTime[_user] = block.timestamp;

			emit Compounded(_user, wethZapped);
		}
	}

	/**
	 * @notice Bounty amount of user per each reward token
	 * @dev returns total WETH amount from swapping all token balances in _pending array
	 * @param _user address
	 * @param _pending array of {rToken, amount}. could be their pending, or an array of penalties already
	 * removed from their pending
	 * @param _execute execute txn or just quote
	 * @param _decrementUserBalance for each rToken amount in _pending, remove from their pending balance
	 */
	function _convertPendingRewardsToWeth(
		address _user,
		IFeeDistribution.RewardData[] memory _pending,
		bool _execute,
		bool _decrementUserBalance
	) internal returns (uint256 wethOut) {
		for (uint256 i = 0; i < _pending.length; i++) {
			address token = _pending[i].token;
			uint256 removedAmount = _pending[i].amount;
			if (removedAmount == 0 || IERC20(token).balanceOf(address(this)) == 0) {
				continue;
			}

			address underlying = mfdHelper.getUnderlying(token);

			if (_execute) {
				uint256 pendingReward = rewards[_user][token].div(1e12);

				if (_decrementUserBalance) {
					require(pendingReward >= removedAmount);
					rewards[_user][token] = rewards[_user][token].sub(removedAmount.mul(1e12));
				}
				rewardData[token].balance = rewardData[token].balance.sub(removedAmount);
				// emit RewardPaid(_user, token, removedAmount);

				ILendingPool lendingPool = ILendingPool(mfdHelper.getLendingPool());
				removedAmount = lendingPool.withdraw(underlying, removedAmount, address(this));
			}

			if (underlying == baseToken) {
				wethOut = wethOut.add(removedAmount);
			} else {
				if (_execute) {
					IERC20(underlying).safeApprove(uniRouter, removedAmount);
					uint256[] memory amounts = IUniswapV2Router01(uniRouter).swapExactTokensForTokens(
						removedAmount,
						0, // slippage handled after this function
						mfdHelper.getRewardToBaseRoute(underlying),
						address(this),
						block.timestamp + 10
					);
					wethOut = wethOut.add(amounts[amounts.length - 1]);
				} else {
					uint256[] memory amounts = IUniswapV2Router01(uniRouter).getAmountsOut(
						removedAmount, //amt in
						mfdHelper.getRewardToBaseRoute(underlying) //path
					);
					wethOut = wethOut.add(amounts[amounts.length - 1]);
				}
			}
		}
	}

	/**
	 * @notice shortcut for above, using users claimable rewards
	 * @param _user address
	 */
	function convertPendingRewardsToWeth(address _user) public returns (uint256 wethOut) {
		return _convertPendingRewardsToWeth(_user, claimableRewards(_user), false, false);
	}

	/**
	 * @notice given WETH, return RDNT
	 * @param _wethIn WETH in
	 * @param _execute whether to execute swap, or return expected amt out
	 */
	function _wethToRdnt(uint256 _wethIn, bool _execute) internal returns (uint256 rdntOut) {
		if (_wethIn != 0) {
			if (_execute) {
				IERC20(baseToken).safeApprove(uniRouter, _wethIn);
				uint256[] memory amounts = IUniswapV2Router01(uniRouter).swapExactTokensForTokens(
					_wethIn,
					0,
					mfdHelper.getRouteToRdnt(),
					address(this),
					block.timestamp + 600
				);
				rdntOut = amounts[amounts.length - 1];
			} else {
				uint256[] memory amounts = IUniswapV2Router01(uniRouter).getAmountsOut(
					_wethIn, //amt in
					mfdHelper.getRouteToRdnt()
				);
				rdntOut = amounts[amounts.length - 1];
			}
		}
	}
}
