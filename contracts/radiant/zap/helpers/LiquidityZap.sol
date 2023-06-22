// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.12;

//:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
//
// LiquidityZAP takes ETH and converts to  liquidity tokens.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// Attribution: CORE / cvault.finance
//  https://github.com/cVault-finance/CORE-periphery/blob/master/contracts/COREv1Router.sol
//
//:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
//----------------------------------------------------------------------------------
//    I n s t a n t
//
//        .:mmm.         .:mmm:.       .ii.  .:SSSSSSSSSSSSS.     .oOOOOOOOOOOOo.
//      .mMM'':Mm.     .:MM'':Mm:.     .II:  :SSs..........     .oOO'''''''''''OOo.
//    .:Mm'   ':Mm.   .:Mm'   'MM:.    .II:  'sSSSSSSSSSSSSS:.  :OO.           .OO:
//  .'mMm'     ':MM:.:MMm'     ':MM:.  .II:  .:...........:SS.  'OOo:.........:oOO'
//  'mMm'        ':MMmm'         'mMm:  II:  'sSSSSSSSSSSSSS'     'oOOOOOOOOOOOO'
//
//----------------------------------------------------------------------------------

import {IUniswapV2Pair} from "@uniswap/lib/contracts/interfaces/IUniswapV2Pair.sol";
import {UniswapV2Library} from "@uniswap/lib/contracts/libraries/UniswapV2Library.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {DustRefunder} from "./DustRefunder.sol";

import {IWETH} from "../../../interfaces/IWETH.sol";
import {IPriceProvider} from "../../../interfaces/IPriceProvider.sol";
import {IChainlinkAggregator} from "../../../interfaces/IChainlinkAggregator.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/// @title Radiant token contract with OFT integration
/// @author Radiant Devs
contract LiquidityZap is Initializable, OwnableUpgradeable, DustRefunder {
	using SafeERC20 for IERC20;

	error ZapExists();
	error InvalidETHAmount();
	error AddressZero();
	error InsufficientPermission();
	error TransferFailed();
	error InvalidRatio();
	error InvalidSlippage();

	/// @notice RAITO Divisor
	uint256 public constant RATIO_DIVISOR = 10000;

	address public _token;
	address public _tokenWETHPair;
	IWETH public weth;
	bool private initializedLiquidityZap;
	address public poolHelper;

	constructor() {
			_disableInitializers();
		}

	/// @notice Acceptable ratio
	uint256 public acceptableRatio;

	/// @notice Price provider contract
	IPriceProvider public priceProvider;

	/// @notice ETH oracle contract
	IChainlinkAggregator public ethOracle;

	/**
	 * @notice Initialize
	 */
	function initialize() external initializer {
		__Ownable_init();
	}

	/**
	 * @notice Initialize liquidity zap param
	 * @param token RDNT address
	 * @param _weth WETH address
	 * @param tokenWethPair LP pair
	 * @param _helper Pool helper contract
	 */
	function initLiquidityZap(address token, address _weth, address tokenWethPair, address _helper) external onlyOwner {
		if (initializedLiquidityZap) revert ZapExists();
		_token = token;
		weth = IWETH(_weth);
		_tokenWETHPair = tokenWethPair;
		initializedLiquidityZap = true;
		poolHelper = _helper;
	}

	fallback() external payable {
		if (msg.sender != address(weth)) {
			addLiquidityETHOnly(payable(msg.sender));
		}
	}

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
	 * @notice Set Acceptable Ratio.
	 * @param _acceptableRatio Acceptable slippage ratio.
	 */
	function setAcceptableRatio(uint256 _acceptableRatio) external onlyOwner {
		if (_acceptableRatio > RATIO_DIVISOR) revert InvalidRatio();
		acceptableRatio = _acceptableRatio;
	}

	/**
	 * @notice Zap ethereum
	 * @param _onBehalf of the user
	 * @return liquidity lp amount
	 */
	function zapETH(address payable _onBehalf) external payable returns (uint256) {
		if (msg.value == 0) revert InvalidETHAmount();
		return addLiquidityETHOnly(_onBehalf);
	}

	/**
	 * @notice Add liquidity with WETH
	 * @param _amount of WETH
	 * @param to address of lp token
	 * @return liquidity lp amount
	 */
	function addLiquidityWETHOnly(uint256 _amount, address payable to) public returns (uint256) {
		if (msg.sender != poolHelper) revert InsufficientPermission();
		if (to == address(0)) revert AddressZero();
		uint256 buyAmount = _amount / 2;
		if (buyAmount == 0) revert InvalidETHAmount();

		(uint256 reserveWeth, uint256 reserveTokens) = getPairReserves();
		uint256 outTokens = UniswapV2Library.getAmountOut(buyAmount, reserveWeth, reserveTokens);

		weth.transfer(_tokenWETHPair, buyAmount);

		(address token0, address token1) = UniswapV2Library.sortTokens(address(weth), _token);
		IUniswapV2Pair(_tokenWETHPair).swap(
			_token == token0 ? outTokens : 0,
			_token == token1 ? outTokens : 0,
			address(this),
			""
		);

		return _addLiquidity(outTokens, buyAmount, to);
	}

	/**
	 * @notice Add liquidity with ETH
	 * @param to address of lp token
	 * @return liquidity lp amount
	 */
	function addLiquidityETHOnly(address payable to) public payable returns (uint256) {
		if (to == address(0)) revert AddressZero();
		uint256 buyAmount = msg.value / 2;
		if (buyAmount == 0) revert InvalidETHAmount();
		weth.deposit{value: msg.value}();

		(uint256 reserveWeth, uint256 reserveTokens) = getPairReserves();
		uint256 outTokens = UniswapV2Library.getAmountOut(buyAmount, reserveWeth, reserveTokens);

		if (address(priceProvider) != address(0)) {
			uint256 slippage = _calcSlippage(buyAmount, outTokens);
			if (slippage < acceptableRatio) revert InvalidSlippage();
		}

		weth.transfer(_tokenWETHPair, buyAmount);

		(address token0, address token1) = UniswapV2Library.sortTokens(address(weth), _token);
		IUniswapV2Pair(_tokenWETHPair).swap(
			_token == token0 ? outTokens : 0,
			_token == token1 ? outTokens : 0,
			address(this),
			""
		);

		return _addLiquidity(outTokens, buyAmount, to);
	}

	/**
	 * @notice Quote WETH amount from RDNT
	 * @param tokenAmount RDNT amount
	 * @return optimalWETHAmount Output WETH amount
	 */
	function quoteFromToken(uint256 tokenAmount) public view returns (uint256 optimalWETHAmount) {
		(uint256 wethReserve, uint256 tokenReserve) = getPairReserves();
		optimalWETHAmount = UniswapV2Library.quote(tokenAmount, tokenReserve, wethReserve);
	}

	/**
	 * @notice Quote RDNT amount from WETH
	 * @param wethAmount RDNT amount
	 * @return optimalTokenAmount Output RDNT amount
	 */
	function quote(uint256 wethAmount) public view returns (uint256 optimalTokenAmount) {
		(uint256 wethReserve, uint256 tokenReserve) = getPairReserves();
		optimalTokenAmount = UniswapV2Library.quote(wethAmount, wethReserve, tokenReserve);
	}

	/**
	 * @notice Add liquidity with RDNT and WETH
	 * @dev use with quote
	 * @param tokenAmount RDNT amount
	 * @param _wethAmt WETH amount
	 * @param to LP address to be transferred
	 * @return liquidity LP amount
	 */
	function standardAdd(uint256 tokenAmount, uint256 _wethAmt, address payable to) public returns (uint256) {
		if (to == address(0)) revert AddressZero();
		if (tokenAmount == 0 || _wethAmt == 0) revert InvalidETHAmount();
		IERC20(_token).safeTransferFrom(msg.sender, address(this), tokenAmount);
		weth.transferFrom(msg.sender, address(this), _wethAmt);
		return _addLiquidity(tokenAmount, _wethAmt, to);
	}

	/**
	 * @notice Add liquidity with RDNT and WETH
	 * @dev use with quote
	 * @param tokenAmount RDNT amount
	 * @param wethAmount WETH amount
	 * @param to LP address to be transferred
	 * @return liquidity LP amount
	 */
	function _addLiquidity(
		uint256 tokenAmount,
		uint256 wethAmount,
		address payable to
	) internal returns (uint256 liquidity) {
		uint256 optimalTokenAmount = quote(wethAmount);

		uint256 optimalWETHAmount;
		if (optimalTokenAmount > tokenAmount) {
			optimalWETHAmount = quoteFromToken(tokenAmount);
			optimalTokenAmount = tokenAmount;
		} else optimalWETHAmount = wethAmount;

		bool wethTransferSuccess = weth.transfer(_tokenWETHPair, optimalWETHAmount);
		if (!wethTransferSuccess) revert TransferFailed();
		IERC20(_token).safeTransfer(_tokenWETHPair, optimalTokenAmount);

		liquidity = IUniswapV2Pair(_tokenWETHPair).mint(to);

		//refund dust
		refundDust(_token, address(weth), to);
	}

	/**
	 * @notice LP token amount entitled with ETH
	 * @param ethAmt ETH amount
	 * @return liquidity LP amount
	 */
	function getLPTokenPerEthUnit(uint256 ethAmt) public view returns (uint256 liquidity) {
		(uint256 reserveWeth, uint256 reserveTokens) = getPairReserves();
		uint256 outTokens = UniswapV2Library.getAmountOut(ethAmt / 2, reserveWeth, reserveTokens);
		uint256 _totalSupply = IUniswapV2Pair(_tokenWETHPair).totalSupply();

		(address token0, ) = UniswapV2Library.sortTokens(address(weth), _token);
		(uint256 amount0, uint256 amount1) = token0 == _token ? (outTokens, ethAmt / 2) : (ethAmt / 2, outTokens);
		(uint256 _reserve0, uint256 _reserve1) = token0 == _token
			? (reserveTokens, reserveWeth)
			: (reserveWeth, reserveTokens);
		liquidity = Math.min(amount0 * _totalSupply / _reserve0, amount1 * _totalSupply / _reserve1);
	}

	/**
	 * @notice Get amount of lp reserves
	 * @return wethReserves WETH amount
	 * @return tokenReserves RDNT amount
	 */
	function getPairReserves() internal view returns (uint256 wethReserves, uint256 tokenReserves) {
		(address token0, ) = UniswapV2Library.sortTokens(address(weth), _token);
		(uint256 reserve0, uint256 reserve1, ) = IUniswapV2Pair(_tokenWETHPair).getReserves();
		(wethReserves, tokenReserves) = token0 == _token ? (reserve1, reserve0) : (reserve0, reserve1);
	}

	/**
	 * @notice Calculates slippage ratio from weth to RDNT
	 * @param _ethAmt ETH amount
	 * @param _tokens RDNT token amount
	 */
	function _calcSlippage(uint256 _ethAmt, uint256 _tokens) internal returns (uint256 ratio) {
		priceProvider.update();
		uint256 tokenAmtEth = _tokens * priceProvider.getTokenPrice() * 1e18 / (10 ** priceProvider.decimals()); // price decimal is 8
		ratio = tokenAmtEth.mul(RATIO_DIVISOR).div(_ethAmt);
		ratio = ratio.div(1E18);
	}
}
