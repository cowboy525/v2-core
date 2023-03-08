// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
pragma abicoder v2;

import "../interfaces/IAToken.sol";
import "../interfaces/IMultiFeeDistribution.sol";
import "@uniswap/lib/contracts/interfaces/IUniswapV2Router.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../dependencies/openzeppelin/upgradeability/Initializable.sol";
import "../dependencies/openzeppelin/upgradeability/OwnableUpgradeable.sol";
import "../dependencies/openzeppelin/upgradeability/PausableUpgradeable.sol";
import "../interfaces/ILendingPoolAddressesProvider.sol";
import "../interfaces/ILendingPool.sol";
import "../interfaces/ILockZap.sol";
import "../interfaces/IChefIncentivesController.sol";
import "../interfaces/IMultiFeeDistribution.sol";
import "../interfaces/IPriceProvider.sol";
import "../interfaces/IEligibilityDataProvider.sol";

contract BountyManagerBountiesUpgradeTest is Initializable, OwnableUpgradeable, PausableUpgradeable {
	using SafeMath for uint256;
	using SafeERC20 for IERC20;

	address public rdnt;
	address public weth;
	address mfd;
	address lpMfd;
	address chef;
	address public priceProvider;
	address public eligibilityDataProvider;
	uint256 public HUNTER_SHARE;
	uint256 public baseBountyUsdTarget; // decimals 18
	uint256 public maxBaseBounty;
	uint256 public bountyBooster;
	uint256 public bountyCount;
	uint256 public minDLPBalance;
	uint256 slippageLimit;

	// Array of available Bounty functions to run. See getLpMfdBounty, getChefBounty, etc.
	mapping(uint256 => function(address, bool) returns (address, uint256, bool)) private bounties;

	event Disqualified(address user);
	event ChefIncentivesControllerUpdated(IChefIncentivesController _chef);
	event BaseBountyUsdTargetUpdated(uint256 _newVal);
	event HunterShareUpdated(uint256 _newVal);
	event MaxBaseBountyUpdated(uint256 _newVal);
	event BountyBoosterUpdated(uint256 _newVal);
	event SlippageLimitUpdated(uint256 _newVal);
	event BountyReserveEmpty(uint256 _bal);

	/**
	 * @notice Initialize
	 * @param _rdnt RDNT address
	 * @param _weth WETH address
	 * @param _lpMfd LP MFD, to query bounties on expired locks + autocompounds
	 * @param _mfd MFD, to send bounties as vesting RDNT to Hunter (user calling bounty)
	 * @param _chef CIC, to query bounties for ineligible emissions
	 * @param _priceProvider PriceProvider service, to get RDNT price for bounty quotes
	 * @param _hunterShare % of reclaimed rewards to send to Hunter
	 * @param _baseBountyUsdTarget Base Bounty is paid in RDNT, will scale to match this USD target value
	 * @param _maxBaseBounty cap the scaling above
	 * @param _bountyBooster when bounties need boosting to clear queue, add this amount (in RDNT)
	 */
	function initialize(
		address _rdnt,
		address _weth,
		address _lpMfd,
		address _mfd,
		address _chef,
		address _priceProvider,
		address _eligibilityDataProvider,
		uint256 _hunterShare,
		uint256 _baseBountyUsdTarget,
		uint256 _maxBaseBounty,
		uint256 _bountyBooster
	) external initializer {
		require(_rdnt != address(0));
		require(_weth != address(0));
		require(_lpMfd != address(0));
		require(_mfd != address(0));
		require(_chef != address(0));
		require(_priceProvider != address(0));
		require(_eligibilityDataProvider != address(0));
		require(_hunterShare <= 10000);
		require(_baseBountyUsdTarget != 0);
		require(_maxBaseBounty != 0);

		rdnt = _rdnt;
		weth = _weth;
		lpMfd = _lpMfd;
		mfd = _mfd;
		chef = _chef;
		priceProvider = _priceProvider;
		eligibilityDataProvider = _eligibilityDataProvider;

		HUNTER_SHARE = _hunterShare;
		baseBountyUsdTarget = _baseBountyUsdTarget;
		bountyBooster = _bountyBooster;
		maxBaseBounty = _maxBaseBounty;

		bounties[1] = getLpMfdBounty;
		bounties[2] = getChefBounty;
		bounties[3] = getAutoCompoundBounty;
		bountyCount = 3;

		slippageLimit = 10;
		minDLPBalance = uint256(5).mul(10**18);

		__Ownable_init();
		__Pausable_init();
	}

	/**
	 * @notice Given a user, return their bounty amount. uses staticcall to run same bounty aglo, but without execution
	 * @param _user address
	 * @return bounty amount of RDNT Hunter will recieve.
	 * can be a fixed amt (Base Bounty) or dynamic amt based on rewards removed from target user during execution (ineligible revenue, autocompound fee)
	 * @return actionType which of the 3 bounty types (above) to run.
	 * getBestBounty returns this based on priority (expired locks first, then inelig emissions, then autocompound)
	 */
	function quote(address _user) public view whenNotPaused returns (uint256 bounty, uint256 actionType) {
		(bool success, bytes memory data) = address(this).staticcall(
			abi.encodeWithSignature("executeBounty(address,bool,uint256,uint256)", _user, false, 0, 0)
		);
		require(success, "quote fail");

		(bounty, actionType) = abi.decode(data, (uint256, uint256));
	}

	/**
	 * @notice Execute a bounty.
	 * @param _user address
	 * @param _expectedBounty result from quote above, used for slippage handling
	 * can be a fixed amt (Base Bounty) or dynamic amt based on rewards removed from target user during execution (ineligible revenue, autocompound fee)
	 * @param _actionType which of the 3 bounty types (above) to run.
	 * @return bounty in RDNT to be paid to Hunter (via vesting)
	 * @return actionType which bounty ran
	 */
	function claim(
		address _user,
		uint256 _expectedBounty,
		uint256 _actionType
	) public whenNotPaused returns (uint256 bounty, uint256 actionType) {
		return executeBounty(_user, true, _expectedBounty, _actionType);
	}

	/**
	 * @notice Execute the most appropriate bounty on a user, check returned amount for slippage, calc amount going to Hunter, send to vesting.
	 * @param _user address
	 * @param _execute whether to execute this txn, or just quote what its execution would return
	 * @param _expectedBounty result from quote above, used for slippage handling
	 * can be a fixed amt (Base Bounty) or dynamic amt based on rewards removed from target user during execution (ineligible revenue, autocompound fee)
	 * @param _actionType which of the 3 bounty types (above) to run.
	 * @return bounty in RDNT to be paid to Hunter (via vesting)
	 * @return actionType which bounty ran
	 */
	function executeBounty(
		address _user,
		bool _execute,
		uint256 _expectedBounty,
		uint256 _actionType
	) public whenNotPaused returns (uint256 bounty, uint256 actionType) {
		require(!_execute || (_execute && _expectedBounty != 0), "quote required");

		if (msg.sender != address(this)) {
			(, , uint256 lockedLP, , ) = IMFDPlus(lpMfd).lockedBalances(msg.sender);
			require(lockedLP >= minDLPBalance, "No enough DLP balance to be able to bounty");
			require(
				IEligibilityDataProvider(eligibilityDataProvider).isEligibleForRewards(msg.sender),
				"Bounty executer must be eligible for rewards."
			);
		}

		uint256 totalBounty;
		bool issueBaseBounty;
		address incentivizer;
		uint256 bb = getBaseBounty();

		(incentivizer, totalBounty, issueBaseBounty, actionType) = getBestBounty(_user, _execute, _actionType);

		if (issueBaseBounty) {
			bounty = bb;
		} else {
			if (totalBounty != 0) {
				bounty = totalBounty.mul(HUNTER_SHARE).div(10000);
			}
		}

		uint256 minAmountOut = _expectedBounty.sub(_expectedBounty.mul(slippageLimit).div(100));
		require(bounty >= minAmountOut, "too much slippage");

		if (_execute && bounty != 0) {
			if (!issueBaseBounty) {
				IERC20(rdnt).safeTransferFrom(incentivizer, address(this), totalBounty);
			}
			_sendBounty(msg.sender, bounty);
		}
	}

	/**
	 * @notice Given a user and actionType, execute that bounty on either CIC or MFD.
	 * @param _user address
	 * @param _execute whether to execute this txn, or just quote what its execution would return
	 * @param _actionTypeIndex, which of the 3 bounty types (above) to run.
	 * @return incentivizer the contract that had a bounty operation performed for it.
	 * Either CIC (to remove ineligible user from emission pool, or MFD to remove expired locks)
	 * @return totalBounty raw amount of RDNT returned from Incentivizer. Hunter % will be deducted from this.
	 * @return issueBaseBounty whether Incentivizer will pay bounty from its own RDNT reserve, or from this contracts RDNT reserve
	 * @return actionType the action type index executed
	 */
	function getBestBounty(
		address _user,
		bool _execute,
		uint256 _actionTypeIndex
	)
		internal
		returns (
			address incentivizer,
			uint256 totalBounty,
			bool issueBaseBounty,
			uint256 actionType
		)
	{
		if (_actionTypeIndex != 0) {
			// execute bounty w/ given params
			(incentivizer, totalBounty, issueBaseBounty) = bounties[_actionTypeIndex](_user, _execute);
			actionType = _actionTypeIndex;
		} else {
			for (uint256 i = 1; i <= bountyCount; i++) {
				(incentivizer, totalBounty, issueBaseBounty) = bounties[i](_user, _execute);
				if (totalBounty != 0 || issueBaseBounty) {
					actionType = i;
					break;
				}
			}
		}
	}

	/**
	 * @notice call MFDPlus.claimBounty()
	 * @param _user address
	 * @param _execute whether to execute this txn, or just quote what its execution would return
	 * @return incentivizer in this case MFD
	 * @return totalBounty RDNT to pay for this _user's bounty execution
	 * @return issueBaseBounty true when user has autorelock,
	 * false when !autorelock because they will have rewards removed from their ineligible time after locks expired
	 */
	function getLpMfdBounty(address _user, bool _execute)
		internal
		returns (
			address incentivizer,
			uint256 totalBounty,
			bool issueBaseBounty
		)
	{
		(totalBounty, issueBaseBounty) = IMFDPlus(lpMfd).claimBounty(_user, _execute);
		incentivizer = lpMfd;
	}

	/**
	 * @notice call CIC.claimBounty()
	 * @param _user address
	 * @param _execute whether to execute this txn, or just quote what its execution would return
	 * @return incentivizer in this case CIC
	 * @return totalBounty RDNT to pay for this _user's bounty execution
	 * @return issueBaseBounty true when user has autorelock or when disqualified because their lock value dropped below 5% threshold
	 * false when !autorelock because they will have rewards removed from their ineligible time after locks expired
	 */
	function getChefBounty(address _user, bool _execute)
		internal
		returns (
			address incentivizer,
			uint256 totalBounty,
			bool issueBaseBounty
		)
	{
		(totalBounty, issueBaseBounty) = IChefIncentivesController(chef).claimBounty(_user, _execute);
		incentivizer = chef;
	}

	/**
	 * @notice call MFDPlus.claimCompound(). compound pending rewards for _user into locked LP
	 * @param _user address
	 * @param _execute whether to execute this txn, or just quote what its execution would return
	 * @return incentivizer in this case MFDPlus
	 * @return totalBounty RDNT to pay for this _user's bounty execution. paid from Autocompound fee
	 * @return issueBaseBounty always false since bounty paid from compound fee
	 */
	function getAutoCompoundBounty(address _user, bool _execute)
		internal
		returns (
			address incentivizer,
			uint256 totalBounty,
			bool issueBaseBounty
		)
	{
		(totalBounty) = IMFDPlus(lpMfd).claimCompound(_user, _execute);
		issueBaseBounty = false;
		incentivizer = lpMfd;
	}

	/**
	 * @notice just an added function to simulate upgrading the contract to test
	 * the bounties mapping with function pointers
	 * @return derp could be anything really
	 */
	function getDerp() external view returns (uint256 derp) {
		derp = 8;
	}

	/**
	 * @notice Vest a bounty in MFD for successful bounty by Hunter
	 * @param _to Hunter address
	 * @param _amount of RDNT
	 * @return amt added to vesting
	 */
	function _sendBounty(address _to, uint256 _amount) internal returns (uint256) {
		if (_amount == 0) {
			return 0;
		}

		uint256 bountyReserve = IERC20(rdnt).balanceOf(address(this));
		if (_amount > bountyReserve) {
			emit BountyReserveEmpty(bountyReserve);
			_pause();
		} else {
			IERC20(rdnt).safeTransfer(address(mfd), _amount);
			IMFDPlus(mfd).mint(_to, _amount, true);
			return _amount;
		}
	}

	/**
	 * @notice Return RDNT amount for Base Bounty.
	 * Base Bounty used to incentivize operations that dont generate their own reward to pay to Hunter.
	 * @return bounty in RDNT
	 */
	function getBaseBounty() public view whenNotPaused returns (uint256 bounty) {
		uint256 rdntPrice = IPriceProvider(priceProvider).getTokenPriceUsd();
		bounty = baseBountyUsdTarget.mul(1e8).div(rdntPrice);
		if (bounty > maxBaseBounty) {
			bounty = maxBaseBounty;
		}
	}

	function setMinDLPBalance(uint256 _minDLPBalance) external onlyOwner {
		minDLPBalance = _minDLPBalance;
	}

	function setBaseBountyUsdTarget(uint256 _newVal) external onlyOwner {
		baseBountyUsdTarget = _newVal;
		emit BaseBountyUsdTargetUpdated(_newVal);
	}

	function setHunterShare(uint256 _newVal) external onlyOwner {
		require(_newVal <= 10000, "override");
		HUNTER_SHARE = _newVal;
		emit HunterShareUpdated(_newVal);
	}

	function setMaxBaseBounty(uint256 _newVal) external onlyOwner {
		maxBaseBounty = _newVal;
		emit MaxBaseBountyUpdated(_newVal);
	}

	function setBountyBooster(uint256 _newVal) external onlyOwner {
		bountyBooster = _newVal;
		emit BountyBoosterUpdated(_newVal);
	}

	function setSlippageLimit(uint256 _newVal) external onlyOwner {
		slippageLimit = _newVal;
		emit SlippageLimitUpdated(_newVal);
	}

	function setBounties() external onlyOwner {
		bounties[1] = getLpMfdBounty;
		bounties[2] = getChefBounty;
		bounties[3] = getAutoCompoundBounty;
	}

	function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
		IERC20(tokenAddress).safeTransfer(owner(), tokenAmount);
	}
}
