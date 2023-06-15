// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "@uniswap/lib/contracts/interfaces/IUniswapV2Router.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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

contract Compounder is OwnableUpgradeable, PausableUpgradeable {
	using SafeERC20 for IERC20;

	struct RewardData {
		address token;
		uint256 amount;
	}

	event RewardBaseTokensUpdated(address[] _tokens);

	event RoutesUpdated(address _token, address[] _routes);

	error AddressZero();

	error InvalidCompoundFee();

	error InvalidSlippage();

	error NotBountyManager();

	error NotEligible();

	error InsufficientStakeAmount();

	error ArrayLengthMismatch();

	uint256 public constant PERCENT_DIVISOR = 10000;
	uint256 public compoundFee;
	uint256 public slippageLimit;

	IMintableToken public rdntToken;
	address public baseToken; //token that rdnt is paired with in LP
	address public addressProvider;
	address public priceProvider;
	address[] public rewardBaseTokens;
	address[] public wethToRadiant;
	address public uniRouter;
	address public multiFeeDistribution;
	address public lockZap;
	address public bountyManager;
	mapping(address => uint256) public lastAutocompound;
	mapping(address => address[]) public rewardToBaseRoute;

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

	function pause() public onlyOwner {
		_pause();
	}

	function unpause() public onlyOwner {
		_unpause();
	}

	function addRewardBaseTokens(address[] memory _tokens) external onlyOwner {
		rewardBaseTokens = _tokens;
		emit RewardBaseTokensUpdated(_tokens);
	}

	function setRoutes(address _token, address[] memory _routes) external onlyOwner {
		rewardToBaseRoute[_token] = _routes;
		emit RoutesUpdated(_token, _routes);
	}

	function setBountyManager(address _manager) external onlyOwner {
		if (_manager == address(0)) revert AddressZero();
		bountyManager = _manager;
	}

	function setCompoundFee(uint256 _compoundFee) external onlyOwner {
		if (_compoundFee <= 0) revert InvalidCompoundFee();
		if (_compoundFee > 2000) revert InvalidCompoundFee();
		compoundFee = _compoundFee;
	}

	function setSlippageLimit(uint256 _slippageLimit) external onlyOwner {
		_validateSlippageLimit(_slippageLimit);
		slippageLimit = _slippageLimit;
	}

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
			address underlying = IAToken(rewardBaseTokens[i]).UNDERLYING_ASSET_ADDRESS();
			uint256 amount = lendingPool.withdraw(underlying, type(uint256).max, address(this));

			if (underlying != baseToken) {
				IERC20(underlying).safeApprove(uniRouter, amount);
				try
					IUniswapV2Router(uniRouter).swapExactTokensForTokens(
						amount,
						0,
						rewardToBaseRoute[underlying],
						address(this),
						block.timestamp + 600
					)
				{} catch {}
			}
		}
		return IERC20(baseToken).balanceOf(address(this));
	}

	function _convertBaseToLPandStake(address _user) internal returns (uint256 liquidity) {
		uint256 baseBal = IERC20(baseToken).balanceOf(address(this));
		if (baseBal != 0) {
			IERC20(baseToken).safeApprove(lockZap, baseBal);
			liquidity = ILockZap(lockZap).zapOnBehalf(false, baseBal, 0, _user);
		}
	}

	/**
	 * @notice Compound user's rewards
	 * @dev Can be auto compound or manual compound
	 * @param _user user address
	 * @param _execute whether to execute txn, or just quote (expected amount out for bounty executor)
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
			uint256 pendingInRdnt = _wethToRdnt(noSlippagePendingEth, _execute);
			fee = (pendingInRdnt * compoundFee) / PERCENT_DIVISOR;
			return fee;
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

	function selfCompound() external returns (uint256 fee) {
		fee = claimCompound(msg.sender, true);
	}

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
				tokens[index] = IAToken(pending[i].token).UNDERLYING_ASSET_ADDRESS();
				amts[index] = pending[i].amount;
				index++;
			}
		}
	}

	function _estimateTokensOut(address _in, address _out, uint256 _amtIn) internal view returns (uint256 tokensOut) {
		IAaveOracle oracle = IAaveOracle(ILendingPoolAddressesProvider(addressProvider).getPriceOracle());
		uint256 priceInAsset = oracle.getAssetPrice(_in); //USDC: 100000000
		uint256 priceOutAsset = oracle.getAssetPrice(_out); //WETH: 153359950000
		uint256 decimalsIn = IERC20DetailedBytes(_in).decimals();
		uint256 decimalsOut = IERC20DetailedBytes(_out).decimals();
		tokensOut = (_amtIn * priceInAsset * (10 ** decimalsOut)) / (priceOutAsset * (10 ** decimalsIn));
	}

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

	function _wethToRdnt(uint256 _wethIn, bool _execute) internal returns (uint256 rdntOut) {
		uint256 rdntPrice = IPriceProvider(priceProvider).getTokenPrice();
		if (_wethIn != 0) {
			if (_execute) {
				IERC20(baseToken).safeApprove(uniRouter, _wethIn);
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

	function autocompoundThreshold() public view returns (uint256 minStakeAmtEth) {
		IPriceProvider priceProv = IPriceProvider(priceProvider);

		uint256 minStakeLpAmt = IBountyManager(bountyManager).minDLPBalance();
		uint256 lpPriceEth = priceProv.getLpTokenPrice();

		minStakeAmtEth = (minStakeLpAmt * lpPriceEth) / (10 ** priceProv.decimals());
	}

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

	function isEligibleForCompound(uint256 _pending) public view returns (bool eligible) {
		eligible = _pending >= autocompoundThreshold();
	}

	function userEligibleForCompound(address _user) public view returns (bool eligible) {
		eligible = _userEligibleForCompound(_user);
	}

	function selfEligibleCompound() public view returns (bool eligible) {
		eligible = _userEligibleForCompound(msg.sender);
	}

	function _userEligibleForCompound(address _user) internal view returns (bool eligible) {
		(address[] memory tokens, uint256[] memory amts) = viewPendingRewards(_user);
		uint256 pendingEth = _quoteSwapWithOracles(tokens, amts, baseToken);
		eligible = pendingEth >= autocompoundThreshold();
	}

	function _validateSlippageLimit(uint256 _slippageLimit) internal pure {
		if (_slippageLimit < 8000) {
			if (_slippageLimit >= PERCENT_DIVISOR) {
				revert InvalidSlippage();
			}
		}
	}
}
