// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "@uniswap/lib/contracts/interfaces/IUniswapV2Router.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../../interfaces/IAToken.sol";
import "../../interfaces/IMultiFeeDistribution.sol";
import "../../interfaces/ILendingPoolAddressesProvider.sol";
import "../../interfaces/IAaveOracle.sol";
import "../../interfaces/ILendingPool.sol";
import "../../interfaces/ILockZap.sol";
import "../../interfaces/IPriceProvider.sol";
import "../../interfaces/IFeeDistribution.sol";
import "../../interfaces/IERC20DetailedBytes.sol";
import "../../interfaces/IMintableToken.sol";
import "../../interfaces/IBountyManager.sol";

/// @title Compounder Contract
/// @author Radiant
contract Compounder is OwnableUpgradeable, PausableUpgradeable {
	using SafeERC20 for IERC20;

	/// @notice Reward data struct
	struct RewardData {
		address token;
		uint256 amount;
	}

	/********************** Events ***********************/

	/// @notice Emitted when reward base tokens are updated
	event RewardBaseTokensUpdated(address[] _tokens);

	/// @notice Emitted when routes are updated
	event RoutesUpdated(address _token, address[] _routes);

	event BountyManagerUpdated(address indexed _manager);

	event CompoundFeeUpdated(uint256 indexed _compoundFee);

	event SlippageLimitUpdated(uint256 indexed _slippageLimit);

	/********************** Errors ***********************/
	error AddressZero();

	error InvalidCompoundFee();

	error InvalidSlippage();

	error NotBountyManager();

	error NotEligible();

	error InsufficientStakeAmount();

	error ArrayLengthMismatch();

	error SwapFailed(address asset, uint256 amount);

	/// @notice Percent divisor which is equal to 100%
	uint256 public constant PERCENT_DIVISOR = 10000;
	/// @notice Fee of compounding
	uint256 public compoundFee;
	/// @notice Slippage limit
	uint256 public slippageLimit;

	/// @notice RDNT token
	IMintableToken public rdntToken;
	/// @notice Token that rdnt is paired with in LP
	address public baseToken;
	/// @notice Lending pool address provider contract
	address public addressProvider;
	/// @notice Price provider contract
	address public priceProvider;
	/// @notice Array of reward base tokens
	address[] public rewardBaseTokens;
	/// @notice Swap route for WETH to RDNT
	address[] public wethToRadiant;
	/// @notice Uniswap router address
	address public uniRouter;
	/// @notice MFD address
	address public multiFeeDistribution;
	/// @notice LockZap address
	address public lockZap;
	/// @notice Bounty Manager address
	address public bountyManager;
	/// @notice Last auto compound timestamp
	mapping(address => uint256) public lastAutocompound;
	/// @notice Reward to base swap route
	mapping(address => address[]) public rewardToBaseRoute;

	constructor() {
		_disableInitializers();
	}

	/**
	 * @notice Initializer
	 * @param _uniRouter Uniswap router address
	 * @param _mfd MFD address
	 * @param _baseToken Base token address
	 * @param _addressProvider Lending pool address provider
	 * @param _lockZap Lockzap contract
	 * @param _compoundFee Compounding fee
	 * @param _slippageLimit Slippage limit
	 */
	function initialize(
		address _uniRouter,
		address _mfd,
		address _baseToken,
		address _addressProvider,
		address _lockZap,
		uint256 _compoundFee,
		uint256 _slippageLimit
	) public initializer {
		if (_uniRouter == address(0)) revert AddressZero();
		if (_mfd == address(0)) revert AddressZero();
		if (_baseToken == address(0)) revert AddressZero();
		if (_addressProvider == address(0)) revert AddressZero();
		if (_lockZap == address(0)) revert AddressZero();
		if (_compoundFee <= 0) revert InvalidCompoundFee();
		if (_compoundFee > 2000) revert InvalidCompoundFee();
		_validateSlippageLimit(_slippageLimit);

		uniRouter = _uniRouter;
		multiFeeDistribution = _mfd;
		baseToken = _baseToken;
		addressProvider = _addressProvider;
		lockZap = _lockZap;
		rdntToken = IMultiFeeDistribution(multiFeeDistribution).rdntToken();
		priceProvider = IMultiFeeDistribution(multiFeeDistribution).getPriceProvider();
		wethToRadiant = [baseToken, address(rdntToken)];
		compoundFee = _compoundFee;
		slippageLimit = _slippageLimit;
		__Ownable_init();
		__Pausable_init();
	}

	/**
	 * @notice Pause contract
	 */
	function pause() public onlyOwner {
		_pause();
	}

	/**
	 * @notice Unpause contract
	 */
	function unpause() public onlyOwner {
		_unpause();
	}

	/**
	 * @notice Add reward base tokens
	 * @param _tokens Array of token addresses
	 */
	function addRewardBaseTokens(address[] memory _tokens) external onlyOwner {
		rewardBaseTokens = _tokens;
		emit RewardBaseTokensUpdated(_tokens);
	}

	/**
	 * @notice Set swap routes
	 * @param _token Token for swap
	 * @param _routes Swap route for token
	 */
	function setRoutes(address _token, address[] memory _routes) external onlyOwner {
		rewardToBaseRoute[_token] = _routes;
		emit RoutesUpdated(_token, _routes);
	}

	/**
	 * @notice Set bounty manager
	 * @param _manager Bounty manager address
	 */
	function setBountyManager(address _manager) external onlyOwner {
		if (_manager == address(0)) revert AddressZero();
		bountyManager = _manager;
		emit BountyManagerUpdated(_manager);
	}

	/**
	 * @notice Set compound fee
	 * @param _compoundFee Sets new compounding fee
	 */
	function setCompoundFee(uint256 _compoundFee) external onlyOwner {
		if (_compoundFee <= 0) revert InvalidCompoundFee();
		if (_compoundFee > 2000) revert InvalidCompoundFee();
		compoundFee = _compoundFee;
		emit CompoundFeeUpdated(_compoundFee);
	}

	/**
	 * @notice Set slippage limit
	 * @param _slippageLimit Sets new slippage limit
	 */
	function setSlippageLimit(uint256 _slippageLimit) external onlyOwner {
		_validateSlippageLimit(_slippageLimit);
		slippageLimit = _slippageLimit;
		emit SlippageLimitUpdated(_slippageLimit);
	}

	/**
	 * @notice Claim and swap them into base token.
	 * @param _user User for claim
	 * @return Total base token amount
	 */
	function _claimAndSwapToBase(address _user) internal returns (uint256) {
		IMultiFeeDistribution mfd = IMultiFeeDistribution(multiFeeDistribution);
		mfd.claimFromConverter(_user);
		ILendingPool lendingPool = ILendingPool(ILendingPoolAddressesProvider(addressProvider).getLendingPool());

		uint256 length = rewardBaseTokens.length;
		for (uint256 i; i < length; i++) {
			uint256 balance = IERC20(rewardBaseTokens[i]).balanceOf(address(this));
			if (balance == 0) {
				continue;
			}
			address tokenToTrade;
			uint256 amount;
			try IAToken(rewardBaseTokens[i]).UNDERLYING_ASSET_ADDRESS() returns (address underlyingAddress) {
				tokenToTrade = underlyingAddress;
				amount = lendingPool.withdraw(tokenToTrade, type(uint256).max, address(this));
			} catch {
				tokenToTrade = rewardBaseTokens[i];
				amount = balance;
			}

			if (tokenToTrade != baseToken) {
				IERC20(tokenToTrade).forceApprove(uniRouter, amount);
				try
					IUniswapV2Router(uniRouter).swapExactTokensForTokens(
						amount,
						0,
						rewardToBaseRoute[tokenToTrade],
						address(this),
						block.timestamp + 600
					)
				{} catch {
					revert SwapFailed(tokenToTrade, amount);
				}
			}
		}
		return IERC20(baseToken).balanceOf(address(this));
	}

	/**
	 * @notice Converts base token to lp token and stake them.
	 * @param _user User for this action
	 * @return liquidity LP token amount
	 */
	function _convertBaseToLPandStake(address _user) internal returns (uint256 liquidity) {
		uint256 baseBal = IERC20(baseToken).balanceOf(address(this));
		if (baseBal != 0) {
			IERC20(baseToken).forceApprove(lockZap, baseBal);
			liquidity = ILockZap(lockZap).zapOnBehalf(false, baseBal, 0, _user);
		}
	}

	/**
	 * @notice Compound user's rewards
	 * @dev Can be auto compound or manual compound
	 * @param _user user address
	 * @param _execute whether to execute txn, or just quote (expected amount out for bounty executor)
	 * @return fee amount
	 */
	function claimCompound(address _user, bool _execute) public returns (uint256 fee) {
		if (paused()) {
			return 0;
		}

		bool isAutoCompound = _user != msg.sender;

		(address[] memory tokens, uint256[] memory amts) = viewPendingRewards(_user);
		uint256 noSlippagePendingEth = _quoteSwapWithOracles(tokens, amts, baseToken);

		if (isAutoCompound) {
			if (msg.sender != bountyManager) revert NotBountyManager();
			bool eligible = isEligibleForAutoCompound(_user, noSlippagePendingEth);
			if (!eligible) {
				if (_execute) {
					revert NotEligible();
				} else {
					return (0);
				}
			}
		} else {
			if (!isEligibleForCompound(noSlippagePendingEth)) revert InsufficientStakeAmount();
		}

		if (!_execute) {
			if (isAutoCompound) {
				uint256 pendingInRdnt = _wethToRdnt(noSlippagePendingEth, _execute);
				fee = (pendingInRdnt * compoundFee) / PERCENT_DIVISOR;
				return fee;
			} else {
				return 0;
			}
		}

		uint256 actualWethAfterSwap = _claimAndSwapToBase(_user);
		if ((PERCENT_DIVISOR * actualWethAfterSwap) / noSlippagePendingEth < slippageLimit) revert InvalidSlippage();

		if (isAutoCompound) {
			fee = _wethToRdnt(((actualWethAfterSwap * compoundFee) / PERCENT_DIVISOR), _execute);
		}

		_convertBaseToLPandStake(_user);

		if (isAutoCompound) {
			rdntToken.approve(bountyManager, fee);
			lastAutocompound[_user] = block.timestamp;
		}
	}

	/**
	 * @notice User compounds their own rewards
	 */
	function selfCompound() external {
		claimCompound(msg.sender, true);
	}

	/**
	 * @notice Gets pending reward amount of the `_user`.
	 * @param _user address
	 * @return tokens address array
	 * @return amts array
	 */
	function viewPendingRewards(address _user) public view returns (address[] memory tokens, uint256[] memory amts) {
		IFeeDistribution.RewardData[] memory pending = IMultiFeeDistribution(multiFeeDistribution).claimableRewards(
			_user
		);
		tokens = new address[](pending.length - 1);
		amts = new uint256[](pending.length - 1);
		uint256 index;
		uint256 length = pending.length;
		for (uint256 i; i < length; i++) {
			if (pending[i].token != address(rdntToken)) {
				try IAToken(pending[i].token).UNDERLYING_ASSET_ADDRESS() returns (address underlyingAddress) {
					tokens[index] = underlyingAddress;
				} catch {
					tokens[index] = pending[i].token;
				}
				amts[index] = pending[i].amount;
				index++;
			}
		}
	}

	/**
	 * @notice Estimate the out tokens amount.
	 * @param _in token address
	 * @param _out token address
	 * @param _amtIn amount of input token
	 * @return tokensOut amount of output
	 */
	function _estimateTokensOut(address _in, address _out, uint256 _amtIn) internal view returns (uint256 tokensOut) {
		IAaveOracle oracle = IAaveOracle(ILendingPoolAddressesProvider(addressProvider).getPriceOracle());
		uint256 priceInAsset = oracle.getAssetPrice(_in); //USDC: 100000000
		uint256 priceOutAsset = oracle.getAssetPrice(_out); //WETH: 153359950000
		uint256 decimalsIn = IERC20DetailedBytes(_in).decimals();
		uint256 decimalsOut = IERC20DetailedBytes(_out).decimals();
		tokensOut = (_amtIn * priceInAsset * (10 ** decimalsOut)) / (priceOutAsset * (10 ** decimalsIn));
	}

	/**
	 * @notice Estimate the out tokens amount.
	 * @param _in array of input token address
	 * @param _amtsIn amount of input tokens
	 * @return amtOut Sum of outputs
	 */
	function _quoteSwapWithOracles(
		address[] memory _in,
		uint256[] memory _amtsIn,
		address _out
	) internal view returns (uint256 amtOut) {
		if (_in.length != _amtsIn.length) revert ArrayLengthMismatch();
		uint256 length = _in.length;
		for (uint256 i; i < length; i++) {
			amtOut += _estimateTokensOut(_in[i], _out, _amtsIn[i]);
		}
	}

	/**
	 * @notice Swap WETH to RDNT.
	 * @param _wethIn WETH input amount
	 * @param _execute Option to excute this action or not
	 * @return rdntOut Output RDNT amount
	 */
	function _wethToRdnt(uint256 _wethIn, bool _execute) internal returns (uint256 rdntOut) {
		if (_execute) {
			IPriceProvider(priceProvider).update();
		}
		uint256 rdntPrice = IPriceProvider(priceProvider).getTokenPrice();
		if (_wethIn != 0) {
			if (_execute) {
				IERC20(baseToken).forceApprove(uniRouter, _wethIn);
				uint256[] memory amounts = IUniswapV2Router01(uniRouter).swapExactTokensForTokens(
					_wethIn,
					0,
					wethToRadiant,
					address(this),
					block.timestamp + 600
				);
				rdntOut = amounts[amounts.length - 1];
			} else {
				uint256[] memory amounts = IUniswapV2Router01(uniRouter).getAmountsOut(
					_wethIn, //amt in
					wethToRadiant
				);
				rdntOut = amounts[amounts.length - 1];
			}
		}
		uint256 ethValueOfRDNT = rdntPrice * rdntOut;
		if (ethValueOfRDNT / 10 ** 8 < (_wethIn * slippageLimit) / 10000) revert InvalidSlippage();
	}

	/**
	 * @notice Returns minimum stake amount in ETH
	 * @return minStakeAmtEth Minimum stake amount in ETH
	 */
	function autocompoundThreshold() public view returns (uint256 minStakeAmtEth) {
		IPriceProvider priceProv = IPriceProvider(priceProvider);

		uint256 minStakeLpAmt = IBountyManager(bountyManager).minDLPBalance();
		uint256 lpPriceEth = priceProv.getLpTokenPrice();

		minStakeAmtEth = (minStakeLpAmt * lpPriceEth) / (10 ** priceProv.decimals());
	}

	/**
	 * @notice Returns if the user is eligible for auto compound
	 * @param _user to check eligibility
	 * @param _pending amount
	 * @return minStakeAmtEth Minimum stake amount in ETH
	 */
	function isEligibleForAutoCompound(address _user, uint256 _pending) public view returns (bool) {
		bool delayComplete = true;
		if (lastAutocompound[_user] != 0) {
			delayComplete = (block.timestamp - lastAutocompound[_user]) >= 1 days;
		}
		return
			IMultiFeeDistribution(multiFeeDistribution).autocompoundEnabled(_user) &&
			isEligibleForCompound(_pending) &&
			delayComplete;
	}

	/**
	 * @notice Returns if the user is eligible for auto compound
	 * @param _pending amount
	 * @return eligible `true` or `false`
	 */
	function isEligibleForCompound(uint256 _pending) public view returns (bool eligible) {
		eligible = _pending >= autocompoundThreshold();
	}

	/**
	 * @notice Returns if the user is eligible for auto compound
	 * @param _user address
	 * @return eligible `true` or `false`
	 */
	function userEligibleForCompound(address _user) public view returns (bool eligible) {
		eligible = _userEligibleForCompound(_user);
	}

	/**
	 * @notice Returns if the `msg.sender` is eligible for self compound
	 * @return eligible `true` or `false`
	 */
	function selfEligibleCompound() public view returns (bool eligible) {
		eligible = _userEligibleForCompound(msg.sender);
	}

	/**
	* @notice Returns if the user is eligible for auto compound
	* @param _user address the be checked
	* @return eligible `true` if eligible or `false` if not
	*/
	function _userEligibleForCompound(address _user) internal view returns (bool eligible) {
		(address[] memory tokens, uint256[] memory amts) = viewPendingRewards(_user);
		uint256 pendingEth = _quoteSwapWithOracles(tokens, amts, baseToken);
		eligible = pendingEth >= autocompoundThreshold();
	}

	/**
	* @notice Validate if the slippage limit is within the boundaries
	* @param _slippageLimit slippage limit to be validated
	*/
	function _validateSlippageLimit(uint256 _slippageLimit) internal pure {
		if (_slippageLimit < 8000 || _slippageLimit >= PERCENT_DIVISOR) revert InvalidSlippage();
	}
}
