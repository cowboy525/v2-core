// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
pragma abicoder v2;

import "../../interfaces/IMiddleFeeDistribution.sol";
import "../../interfaces/IMultiFeeDistribution.sol";
import "../../interfaces/IMintableToken.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../../dependencies/openzeppelin/upgradeability/Initializable.sol";
import "../../dependencies/openzeppelin/upgradeability/OwnableUpgradeable.sol";

/// @title Fee distributor inside
/// @author Radiant
/// @dev All function calls are currently implemented without side effects
contract MiddleFeeDistribution is IMiddleFeeDistribution, Initializable, OwnableUpgradeable {
	using SafeMath for uint256;
	using SafeERC20 for IERC20;

	/// @notice RDNT token
	IMintableToken public rdntToken;

	/// @notice Fee distributor contract for lp locking
	IMultiFeeDistribution public lpFeeDistribution;

	/// @notice Fee distributor contract for earnings and RDNT lockings
	IMultiFeeDistribution public multiFeeDistribution;

	/// @notice Reward ratio for lp locking in bips
	uint256 public override lpLockingRewardRatio;

	/// @notice Reward ratio for operation expenses
	uint256 public override operationExpenseRatio;

	uint256 public constant RATIO_DIVISOR = 10000;

	mapping(address => bool) public override isRewardToken;

	/// @notice Operation Expense account
	address public override operationExpenses;

	/// @notice Admin address
	address public admin;

	// MFDStats address
	address internal _mfdStats;

	/********************** Events ***********************/

	/// @notice Emitted when ERC20 token is recovered
	event Recovered(address token, uint256 amount);

	/// @notice Emitted when reward token is forwarded
	event ForwardReward(address token, uint256 amount);

	/// @notice Emitted when OpEx info is updated
	event SetOperationExpenses(address opEx, uint256 ratio);

	/// @notice Emitted when LP locking reward ratio is set
	event LpLockingRewardRatioUpdated(uint256 _lpLockingRewardRatio);

	/// @notice Emitted when lp fee distribution is set
	event LPFeeDistributionUpdated(IMultiFeeDistribution _lpFeeDistribution);

	/// @notice Emitted when operation expenses is set
	event OperationExpensesUpdated(address _operationExpenses, uint256 _operationExpenseRatio);

	/**
	 * @dev Throws if called by any account other than the admin or owner.
	 */
	modifier onlyAdminOrOwner() {
		require(admin == _msgSender() || owner() == _msgSender(), "caller is not the admin or owner");
		_;
	}

	function initialize(
		address _rdntToken,
		address mfdStats,
		IMultiFeeDistribution _lpFeeDistribution,
		IMultiFeeDistribution _multiFeeDistribution
	) public initializer {
		__Ownable_init();

		rdntToken = IMintableToken(_rdntToken);
		_mfdStats = mfdStats;
		lpFeeDistribution = _lpFeeDistribution;
		multiFeeDistribution = _multiFeeDistribution;

		lpLockingRewardRatio = 10000;
		admin = msg.sender;
	}

	function getMFDstatsAddress() external view override returns (address) {
		return _mfdStats;
	}

	function getRdntTokenAddress() external view override returns (address) {
		return address(rdntToken);
	}

	function getLPFeeDistributionAddress() external view override returns (address) {
		return address(lpFeeDistribution);
	}

	function getMultiFeeDistributionAddress() external view override returns (address) {
		return address(multiFeeDistribution);
	}

	/**
	 * @notice Returns lock information of a user.
	 * @dev It currently returns just MFD infos.
	 */
	function lockedBalances(address user)
		external
		view
		override
		returns (
			uint256 total,
			uint256 unlockable,
			uint256 locked,
			uint256 lockedWithMultiplier,
			LockedBalance[] memory lockData
		)
	{
		return multiFeeDistribution.lockedBalances(user);
	}

	/**
	 * @notice Set reward ratio for lp token locking
	 */
	function setLpLockingRewardRatio(uint256 _lpLockingRewardRatio) external onlyAdminOrOwner {
		require(_lpLockingRewardRatio <= RATIO_DIVISOR, "Invalid ratio");
		lpLockingRewardRatio = _lpLockingRewardRatio;
		emit LpLockingRewardRatioUpdated(_lpLockingRewardRatio);
	}

	/**
	 * @notice Set lp fee distribution contract
	 */
	function setLPFeeDistribution(IMultiFeeDistribution _lpFeeDistribution) external onlyAdminOrOwner {
		lpFeeDistribution = _lpFeeDistribution;
		emit LPFeeDistributionUpdated(_lpFeeDistribution);
	}

	/**
	 * @notice Set operation expenses account
	 */
	function setOperationExpenses(address _operationExpenses, uint256 _operationExpenseRatio)
		external
		onlyAdminOrOwner
	{
		require(_operationExpenseRatio <= RATIO_DIVISOR, "Invalid ratio");
		operationExpenses = _operationExpenses;
		operationExpenseRatio = _operationExpenseRatio;
		emit OperationExpensesUpdated(_operationExpenses, _operationExpenseRatio);
	}

	/**
	 * @notice Add a new reward token to be distributed to stakers
	 */
	function addReward(address _rewardsToken) external override onlyAdminOrOwner {
		multiFeeDistribution.addReward(_rewardsToken);
		lpFeeDistribution.addReward(_rewardsToken);
		isRewardToken[_rewardsToken] = true;
	}

	/**
	 * @notice Added to support recovering LP Rewards from other systems such as BAL to be distributed to holders
	 */
	function forwardReward(address[] memory _rewardTokens) external override {
		require(msg.sender == address(lpFeeDistribution) || msg.sender == address(multiFeeDistribution));

		for (uint256 i = 0; i < _rewardTokens.length; i += 1) {
			uint256 total = IERC20(_rewardTokens[i]).balanceOf(address(this));

			if (operationExpenses != address(0) && operationExpenseRatio != 0) {
				uint256 opExAmount = total.mul(operationExpenseRatio).div(RATIO_DIVISOR);
				if (opExAmount != 0) {
					IERC20(_rewardTokens[i]).safeTransfer(operationExpenses, opExAmount);
				}
				total = total.sub(opExAmount);
			}
			total = IERC20(_rewardTokens[i]).balanceOf(address(this));
			uint256 lpReward = total.mul(lpLockingRewardRatio).div(RATIO_DIVISOR);
			if (lpReward != 0) {
				IERC20(_rewardTokens[i]).safeTransfer(address(lpFeeDistribution), lpReward);
			}
			uint256 rdntReward = IERC20(_rewardTokens[i]).balanceOf(address(this));
			if (rdntReward != 0) {
				IERC20(_rewardTokens[i]).safeTransfer(address(multiFeeDistribution), rdntReward);
			}
		}
	}

	/**
	 * @notice Added to support recovering LP Rewards from other systems such as BAL to be distributed to holders
	 */
	function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
		IERC20(tokenAddress).safeTransfer(owner(), tokenAmount);
		emit Recovered(tokenAddress, tokenAmount);
	}
}
