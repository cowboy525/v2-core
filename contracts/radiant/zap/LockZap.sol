// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;
pragma abicoder v2;

import {DustRefunder} from "./helpers/DustRefunder.sol";
import {IUniswapV2Factory} from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {Initializable} from "../../dependencies/openzeppelin/upgradeability/Initializable.sol";
import {OwnableUpgradeable} from "../../dependencies/openzeppelin/upgradeability/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "../../dependencies/openzeppelin/upgradeability/PausableUpgradeable.sol";

import {IUniswapV2Router02} from "../../interfaces/uniswap/IUniswapV2Router02.sol";
import {ILiquidityZap} from "../../interfaces/ILiquidityZap.sol";
import {IMultiFeeDistribution} from "../../interfaces/IMultiFeeDistribution.sol";
import {ILendingPool, DataTypes} from "../../interfaces/ILendingPool.sol";
import {IPoolHelper} from "../../interfaces/IPoolHelper.sol";
import {IPriceProvider} from "../../interfaces/IPriceProvider.sol";
import {IChainlinkAggregator} from "../../interfaces/IChainlinkAggregator.sol";
import {IWETH} from "../../interfaces/IWETH.sol";
import {IPriceOracle} from "../../interfaces/IPriceOracle.sol";

/// @title Borrow gate via stargate
/// @author Radiant
/// @dev All function calls are currently implemented without side effects
contract LockZap is Initializable, OwnableUpgradeable, PausableUpgradeable, DustRefunder {
	using SafeERC20 for IERC20;
	using SafeMath for uint256;

	/// @notice RAITO Divisor
	uint256 public constant RATIO_DIVISOR = 10000;

	/// @notice Acceptable ratio
	uint256 public ACCEPTABLE_RATIO;

	/// @notice Wrapped ETH
	IWETH public weth;

	/// @notice RDNT token address
	address public rdntAddr;

	/// @notice Multi Fee distribution contract
	IMultiFeeDistribution public mfd;

	/// @notice Lending Pool contract
	ILendingPool public lendingPool;

	/// @notice Pool helper contract
	IPoolHelper public poolHelper;

	/// @notice Price provider contract
	IPriceProvider public priceProvider;

	/// @notice ETH oracle contract
	IChainlinkAggregator public ethOracle;

	/// @notice Emitted when zap is done
	event Zapped(
		bool _borrow,
		uint256 _ethAmt,
		uint256 _rdntAmt,
		address indexed _from,
		address indexed _onBehalf,
		uint256 _lockTypeIndex
	);

	event SlippageRatioChanged(uint256 newRatio);

	error AddressZero();

	error InvalidRatio();

	error AmountZero();

	error InvalidSlippage();

	error ExceedsAvailableBorrowsETH();

	error InvalidZapETHSource();

	error InsufficientETH();

	uint256 public ethLPRatio; // paramter to set the ratio of ETH in the LP token, can be 2000 for an 80/20 bal lp

	/**
	 * @notice Initializer
	 * @param _poolHelper Pool helper address
	 * @param _lendingPool Lending pool
	 * @param _weth weth address
	 * @param _rdntAddr RDNT token address
	 */
	function initialize(
		IPoolHelper _poolHelper,
		ILendingPool _lendingPool,
		IWETH _weth,
		address _rdntAddr,
		uint256 _ethLPRatio,
		uint256 _ACCEPTABLE_RATIO
	) external initializer {
		if (address(_poolHelper) == address(0)) revert AddressZero();
		if (address(_lendingPool) == address(0)) revert AddressZero();
		if (address(_weth) == address(0)) revert AddressZero();
		if (_rdntAddr == address(0)) revert AddressZero();
		if (_ethLPRatio > 10_000) revert InvalidRatio();

		__Ownable_init();
		__Pausable_init();

		lendingPool = _lendingPool;
		poolHelper = _poolHelper;
		weth = _weth;
		rdntAddr = _rdntAddr;
		ethLPRatio = _ethLPRatio;
		ACCEPTABLE_RATIO = _ACCEPTABLE_RATIO;
	}

	receive() external payable {}

	/**
	 * @notice Set Price Provider.
	 * @param _provider Price provider contract address.
	 */
	function setPriceProvider(address _provider) external onlyOwner {
		if (address(_provider) == address(0)) revert AddressZero();
		priceProvider = IPriceProvider(_provider);
		ethOracle = IChainlinkAggregator(priceProvider.baseTokenPriceInUsdProxyAggregator());
	}

	/**
	 * @notice Set Multi fee distribution contract.
	 * @param _mfdAddr New contract address.
	 */
	function setMfd(address _mfdAddr) external onlyOwner {
		if (address(_mfdAddr) == address(0)) revert AddressZero();
		mfd = IMultiFeeDistribution(_mfdAddr);
	}

	/**
	 * @notice Set Pool Helper contract
	 * @param _poolHelper New PoolHelper contract address.
	 */
	function setPoolHelper(address _poolHelper) external onlyOwner {
		if (address(_poolHelper) == address(0)) revert AddressZero();
		poolHelper = IPoolHelper(_poolHelper);
	}

	/**
	 * @notice Returns pool helper address
	 */
	function getPoolHelper() public view returns (address) {
		return address(poolHelper);
	}

	/**
	 * @notice Get Variable debt token address
	 * @param _asset underlying.
	 */
	function getVDebtToken(address _asset) public view returns (address) {
		DataTypes.ReserveData memory reserveData = lendingPool.getReserveData(_asset);
		return reserveData.variableDebtTokenAddress;
	}

	/**
	 * @notice Get quote from the pool
	 * @param _tokenAmount amount of tokens.
	 */
	function quoteFromToken(uint256 _tokenAmount) public view returns (uint256 optimalWETHAmount) {
		optimalWETHAmount = poolHelper.quoteFromToken(_tokenAmount).mul(100).div(97);
	}

	/**
	 * @notice Zap tokens to stake LP
	 * @param _borrow option to borrow ETH
	 * @param _wethAmt amount of weth.
	 * @param _rdntAmt amount of RDNT.
	 * @param _lockTypeIndex lock length index.
	 */
	function zap(
		bool _borrow,
		uint256 _wethAmt,
		uint256 _rdntAmt,
		uint256 _lockTypeIndex
	) public payable whenNotPaused returns (uint256 liquidity) {
		return _zap(_borrow, _wethAmt, _rdntAmt, msg.sender, msg.sender, _lockTypeIndex, msg.sender);
	}

	/**
	 * @notice Zap tokens to stake LP
	 * @dev It will use default lock index
	 * @param _borrow option to borrow ETH
	 * @param _wethAmt amount of weth.
	 * @param _rdntAmt amount of RDNT.
	 * @param _onBehalf user address to be zapped.
	 */
	function zapOnBehalf(
		bool _borrow,
		uint256 _wethAmt,
		uint256 _rdntAmt,
		address _onBehalf
	) public payable whenNotPaused returns (uint256 liquidity) {
		uint256 duration = mfd.defaultLockIndex(_onBehalf);
		return _zap(_borrow, _wethAmt, _rdntAmt, msg.sender, _onBehalf, duration, _onBehalf);
	}

	/**
	 * @notice Zap tokens from vesting
	 * @param _borrow option to borrow ETH
	 * @param _lockTypeIndex lock length index.
	 */
	function zapFromVesting(
		bool _borrow,
		uint256 _lockTypeIndex
	) public payable whenNotPaused returns (uint256 liquidity) {
		uint256 rdntAmt = mfd.zapVestingToLp(msg.sender);
		uint256 wethAmt = quoteFromToken(rdntAmt);
		return _zap(_borrow, wethAmt, rdntAmt, address(this), msg.sender, _lockTypeIndex, msg.sender);
	}

	/**
	 * @notice Zap tokens like USDC, DAI, USDT, WBTC to lp
	 * @param _asset address of the asset to zap in
	 * @param _amount the amount of asset to zap
	 * @param _lockTypeIndex lock length index.
	 */
	function zapAlternateAsset(address _asset, uint256 _amount, uint256 _lockTypeIndex) public {
		if (_asset == address(0)) revert AddressZero();
		if (_amount == 0) revert AmountZero();
		uint256 assetDecimals = IERC20Metadata(_asset).decimals();
		IPriceOracle priceOracle = IPriceOracle(lendingPool.getAddressesProvider().getPriceOracle());
		uint256 assetPrice = priceOracle.getAssetPrice(_asset);
		uint256 ethPrice = uint256(ethOracle.latestAnswer());
		uint256 expectedEthAmount = (_amount * (10 ** (18 - assetDecimals)) * assetPrice) / ethPrice;

		IERC20(_asset).transferFrom(msg.sender, address(poolHelper), _amount);
		uint256 wethBalanceBefore = weth.balanceOf(address(poolHelper));
		uint256 minAcceptableWeth = (expectedEthAmount * ACCEPTABLE_RATIO) / RATIO_DIVISOR;
		poolHelper.swapToWeth(_asset, _amount, minAcceptableWeth);
		uint256 wethGained = weth.balanceOf(address(this)) - wethBalanceBefore;

		weth.approve(address(poolHelper), wethGained);
		uint256 liquidity = poolHelper.zapWETH(wethGained);

		if (address(priceProvider) != address(0)) {
			uint256 slippage = _calcSlippage(wethGained, liquidity);
			if (slippage < ACCEPTABLE_RATIO) revert InvalidSlippage();
		}

		IERC20(poolHelper.lpTokenAddr()).safeApprove(address(mfd), liquidity);
		mfd.stake(liquidity, msg.sender, _lockTypeIndex);
		emit Zapped(false, wethGained, 0, msg.sender, msg.sender, _lockTypeIndex);

		refundDust(rdntAddr, address(weth), msg.sender);
	}

	/**
	 * @notice Borrow ETH
	 * @param _amount of ETH
	 */
	function _executeBorrow(uint256 _amount) internal {
		(, , uint256 availableBorrowsETH, , , ) = lendingPool.getUserAccountData(msg.sender);
		uint256 amountInETH = _amount.mul(10 ** 8).div(10 ** ERC20(address(weth)).decimals());
		if (availableBorrowsETH < amountInETH) revert ExceedsAvailableBorrowsETH();

		uint16 referralCode = 0;
		lendingPool.borrow(address(weth), _amount, 2, referralCode, msg.sender);
	}

	/**
	 * @notice Calculates slippage ratio from weth to LP
	 * @param _ethAmt ETH amount
	 * @param _liquidity LP token amount
	 */
	function _calcSlippage(uint256 _ethAmt, uint256 _liquidity) internal returns (uint256 ratio) {
		priceProvider.update();
		uint256 ethAmtUsd = _ethAmt.mul(uint256(ethOracle.latestAnswer())).div(1E18);
		uint256 lpAmtUsd = _liquidity * priceProvider.getLpTokenPriceUsd();
		ratio = lpAmtUsd.mul(RATIO_DIVISOR).div(ethAmtUsd);
		ratio = ratio.div(1E18);
	}

	/**
	 * @notice Zap into LP
	 * @param _borrow option to borrow ETH
	 * @param _wethAmt amount of weth.
	 * @param _rdntAmt amount of RDNT.
	 * @param _from src address of RDNT
	 * @param _onBehalf of the user.
	 * @param _lockTypeIndex lock length index.
	 * @param _refundAddress dust is refunded to this address.
	 */
	function _zap(
		bool _borrow,
		uint256 _wethAmt,
		uint256 _rdntAmt,
		address _from,
		address _onBehalf,
		uint256 _lockTypeIndex,
		address _refundAddress
	) internal returns (uint256 liquidity) {
		if (_wethAmt == 0 && msg.value == 0) revert AmountZero();
		if (msg.value != 0) {
			if (_borrow) revert InvalidZapETHSource();
			_wethAmt = msg.value;
			weth.deposit{value: _wethAmt}();
		} else {
			if (_borrow) {
				_executeBorrow(_wethAmt);
			} else {
				weth.transferFrom(msg.sender, address(this), _wethAmt);
			}
		}

		uint256 totalWethValueIn;
		weth.approve(address(poolHelper), _wethAmt);
		//case where rdnt is matched with borrowed ETH
		if (_rdntAmt != 0) {
			if (_wethAmt < poolHelper.quoteFromToken(_rdntAmt)) revert InsufficientETH();

			// _from == this when zapping from vesting
			if (_from != address(this)) {
				IERC20(rdntAddr).safeTransferFrom(msg.sender, address(this), _rdntAmt);
			}

			IERC20(rdntAddr).safeApprove(address(poolHelper), _rdntAmt);
			liquidity = poolHelper.zapTokens(_wethAmt, _rdntAmt);
			totalWethValueIn = _wethAmt.mul(RATIO_DIVISOR).div(ethLPRatio);
		} else {
			liquidity = poolHelper.zapWETH(_wethAmt);
			totalWethValueIn = _wethAmt;
		}

		if (address(priceProvider) != address(0)) {
			uint256 slippage = _calcSlippage(totalWethValueIn, liquidity);
			if (slippage < ACCEPTABLE_RATIO) revert InvalidSlippage();
		}

		IERC20(poolHelper.lpTokenAddr()).safeApprove(address(mfd), liquidity);
		mfd.stake(liquidity, _onBehalf, _lockTypeIndex);
		emit Zapped(_borrow, _wethAmt, _rdntAmt, _from, _onBehalf, _lockTypeIndex);

		refundDust(rdntAddr, address(weth), _refundAddress);
	}

	function pause() external onlyOwner {
		_pause();
	}

	function unpause() external onlyOwner {
		_unpause();
	}

	function setAcceptableRatio(uint256 _newRatio) external onlyOwner {
		if (_newRatio > RATIO_DIVISOR) revert InvalidRatio();
		ACCEPTABLE_RATIO = _newRatio;
		emit SlippageRatioChanged(ACCEPTABLE_RATIO);
	}
}
