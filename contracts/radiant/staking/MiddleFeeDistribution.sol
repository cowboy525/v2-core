// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;
pragma abicoder v2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {Initializable} from "../../dependencies/openzeppelin/upgradeability/Initializable.sol";
import {OwnableUpgradeable} from "../../dependencies/openzeppelin/upgradeability/OwnableUpgradeable.sol";

import {RecoverERC20} from "../libraries/RecoverERC20.sol";
import {IMiddleFeeDistribution} from "../../interfaces/IMiddleFeeDistribution.sol";
import {IMultiFeeDistribution, LockedBalance} from "../../interfaces/IMultiFeeDistribution.sol";
import {IMintableToken} from "../../interfaces/IMintableToken.sol";
import {IAaveOracle} from "../../interfaces/IAaveOracle.sol";
import {IAToken} from "../../interfaces/IAToken.sol";
import {IChainlinkAggregator} from "../../interfaces/IChainlinkAggregator.sol";
import {IAaveProtocolDataProvider} from "../../interfaces/IAaveProtocolDataProvider.sol";

/// @title Fee distributor inside
/// @author Radiant
contract MiddleFeeDistribution is IMiddleFeeDistribution, Initializable, OwnableUpgradeable, RecoverERC20 {
	using SafeMath for uint256;
	using SafeERC20 for IERC20;

	/// @notice RDNT token
	IMintableToken public rdntToken;

	/// @notice Fee distributor contract for earnings and RDNT lockings
	IMultiFeeDistribution public multiFeeDistribution;

	/// @notice Reward ratio for operation expenses
	uint256 public override operationExpenseRatio;

	uint256 public constant RATIO_DIVISOR = 10000;

	uint8 public constant DECIMALS = 18;

	mapping(address => bool) public override isRewardToken;

	/// @notice Operation Expense account
	address public override operationExpenses;

	/// @notice Admin address
	address public admin;

	// AAVE Oracle address
	address internal _aaveOracle;

	// AAVE Protocol Data Provider address
	IAaveProtocolDataProvider public aaveProtocolDataProvider;

	/********************** Events ***********************/

	/// @notice Emitted when reward token is forwarded
	event ForwardReward(address indexed token, uint256 amount);

	/// @notice Emitted when operation expenses is set
	event OperationExpensesUpdated(address indexed _operationExpenses, uint256 _operationExpenseRatio);

	event NewTransferAdded(address indexed asset, uint256 lpUsdValue);

	event AdminUpdated(address indexed _configurator);

	event RewardsUpdated(address indexed _rewardsToken);

	/********************** Errors ***********************/

	error ZeroAddress();

	error IncompatibleToken();

	error InvalidRatio();

	error NotMFD();

	error InsufficientPermission();

	/**
	 * @dev Throws if called by any account other than the admin or owner.
	 */
	modifier onlyAdminOrOwner() {
		require(admin == _msgSender() || owner() == _msgSender(), "caller is not the admin or owner");
		_;
	}

	/**
	 * @notice Initializer
	 * @param _rdntToken RDNT address
	 * @param aaveOracle Aave oracle address
	 * @param _multiFeeDistribution Multi fee distribution contract
	 */
	function initialize(
		address _rdntToken,
		address aaveOracle,
		IMultiFeeDistribution _multiFeeDistribution,
		IAaveProtocolDataProvider _aaveProtocolDataProvider
	) public initializer {
		if (_rdntToken == address(0)) revert ZeroAddress();
		if (aaveOracle == address(0)) revert ZeroAddress();
		__Ownable_init();

		rdntToken = IMintableToken(_rdntToken);
		_aaveOracle = aaveOracle;
		multiFeeDistribution = _multiFeeDistribution;
		aaveProtocolDataProvider = _aaveProtocolDataProvider;

		admin = msg.sender;
	}

	/**
	 * @notice Set operation expenses account
	 * @param _operationExpenses Address to receive operation expenses
	 * @param _operationExpenseRatio Proportion of operation expense
	 */
	function setOperationExpenses(address _operationExpenses, uint256 _operationExpenseRatio) external onlyOwner {
		if (_operationExpenseRatio > RATIO_DIVISOR) revert InvalidRatio();
		if (_operationExpenses == address(0)) revert ZeroAddress();
		operationExpenses = _operationExpenses;
		operationExpenseRatio = _operationExpenseRatio;
		emit OperationExpensesUpdated(_operationExpenses, _operationExpenseRatio);
	}

	/**
	 * @notice Sets pool configurator as admin.
	 * @param _configurator Configurator address
	 */
	function setAdmin(address _configurator) external onlyOwner {
		if (_configurator == address(0)) revert ZeroAddress();
		admin = _configurator;
		emit AdminUpdated(_configurator);
	}

	/**
	 * @notice Set the Protocol Data Provider address
	 * @param _providerAddress The address of the protocol data provider contract
	 */
	function setProtocolDataProvider(address _providerAddress) external onlyOwner {
		if (_providerAddress == address(0)) revert ZeroAddress();
		aaveProtocolDataProvider = IAaveProtocolDataProvider(_providerAddress);
	}

	/**
	 * @notice Add a new reward token to be distributed to stakers
	 * @param _rewardsToken address of the reward token
	 */
	function addReward(address _rewardsToken) external override onlyAdminOrOwner {
		if (msg.sender != admin) {
			try IAToken(_rewardsToken).UNDERLYING_ASSET_ADDRESS() returns (address underlying) {
				(address aTokenAddress, , ) = aaveProtocolDataProvider.getReserveTokensAddresses(underlying);
				if (aTokenAddress == address(0)) revert IncompatibleToken();
			} catch {
				// _rewardsToken is not an rToken, do nothing
			}
		}
		multiFeeDistribution.addReward(_rewardsToken);
		isRewardToken[_rewardsToken] = true;
		emit RewardsUpdated(_rewardsToken);
	}

	/**
	 * @notice Run by MFD to pull pending platform revenue
	 * @param _rewardTokens an array of reward token addresses
	 */
	function forwardReward(address[] memory _rewardTokens) external override {
		if (msg.sender != address(multiFeeDistribution)) revert NotMFD();

		uint256 length = _rewardTokens.length;
		for (uint256 i = 0; i < length; i += 1) {
			address rewardToken = _rewardTokens[i];
			uint256 total = IERC20(rewardToken).balanceOf(address(this));

			if (operationExpenses != address(0) && operationExpenseRatio != 0) {
				uint256 opExAmount = total.mul(operationExpenseRatio).div(RATIO_DIVISOR);
				if (opExAmount != 0) {
					IERC20(rewardToken).safeTransfer(operationExpenses, opExAmount);
				}
			}

			total = IERC20(rewardToken).balanceOf(address(this));
			IERC20(rewardToken).safeTransfer(address(multiFeeDistribution), total);

			if (rewardToken == address(rdntToken)) {
				multiFeeDistribution.mint(address(multiFeeDistribution), total, false);
			}

			emit ForwardReward(rewardToken, total);

			emitNewTransferAdded(rewardToken, total);
		}
	}

	/**
	 * @notice Returns RDNT token address.
	 * @return RDNT token address
	 */
	function getRdntTokenAddress() external view override returns (address) {
		return address(rdntToken);
	}

	/**
	 * @notice Returns MFD address.
	 * @return MFD address
	 */
	function getMultiFeeDistributionAddress() external view override returns (address) {
		return address(multiFeeDistribution);
	}

	/**
	 * @notice Emit event for new asset reward
	 * @param asset address of transfer assset
	 * @param lpReward amount of rewards
	 */
	function emitNewTransferAdded(address asset, uint256 lpReward) internal {
		uint256 lpUsdValue;
		if (asset != address(rdntToken)) {
			try IAToken(asset).UNDERLYING_ASSET_ADDRESS() returns (address underlyingAddress) {
				uint256 assetPrice = IAaveOracle(_aaveOracle).getAssetPrice(underlyingAddress);
				address sourceOfAsset = IAaveOracle(_aaveOracle).getSourceOfAsset(underlyingAddress);
				uint8 priceDecimal = IChainlinkAggregator(sourceOfAsset).decimals();
				uint8 assetDecimals = IERC20Metadata(asset).decimals();
				lpUsdValue = assetPrice.mul(lpReward).mul(10 ** DECIMALS).div(10 ** priceDecimal).div(
					10 ** assetDecimals
				);
			} catch {
				uint256 assetPrice = IAaveOracle(_aaveOracle).getAssetPrice(asset);
				address sourceOfAsset = IAaveOracle(_aaveOracle).getSourceOfAsset(asset);
				uint8 priceDecimal = IChainlinkAggregator(sourceOfAsset).decimals();
				uint8 assetDecimals = IERC20Metadata(asset).decimals();
				lpUsdValue = assetPrice.mul(lpReward).mul(10 ** DECIMALS).div(10 ** priceDecimal).div(
					10 ** assetDecimals
				);
			}
			emit NewTransferAdded(asset, lpUsdValue);
		}
	}

	/**
	 * @notice Added to support recovering any ERC20 tokens inside the contract
	 * @param tokenAddress address of erc20 token to recover
	 * @param tokenAmount amount to recover
	 */
	function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
		_recoverERC20(tokenAddress, tokenAmount);
	}
}
