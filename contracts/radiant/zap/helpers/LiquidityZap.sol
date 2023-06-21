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
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IWETH} from "../../../interfaces/IWETH.sol";
import {Initializable} from "../../../dependencies/openzeppelin/upgradeability/Initializable.sol";
import {OwnableUpgradeable} from "../../../dependencies/openzeppelin/upgradeability/OwnableUpgradeable.sol";

/// @title Radiant token contract with OFT integration
/// @author Radiant Devs
/// @dev All function calls are currently implemented without side effects
contract LiquidityZap is Initializable, OwnableUpgradeable {
	using SafeERC20 for IERC20;
	using SafeMath for uint256;

	error ZapExists();
	error InvalidETHAmount();
	error AddressZero();
	error InsufficientPermision();

	address public _token;
	address public _tokenWETHPair;
	IWETH public weth;
	bool private initialized;
	address public poolHelper;

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
	function initLiquidityZap(address token, address _weth, address tokenWethPair, address _helper) external {
		if (initialized) revert ZapExists();
		_token = token;
		weth = IWETH(_weth);
		_tokenWETHPair = tokenWethPair;
		initialized = true;
		poolHelper = _helper;
	}

	fallback() external payable {
		if (msg.sender != address(weth)) {
			addLiquidityETHOnly(payable(msg.sender));
		}
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
		if (msg.sender != poolHelper) revert InsufficientPermision();
		if (to == address(0)) revert AddressZero();
		uint256 buyAmount = _amount.div(2);
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
		uint256 buyAmount = msg.value.div(2);
		if (buyAmount == 0) revert InvalidETHAmount();
		weth.deposit{value: msg.value}();

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
	 * @param to LP address to be transfered
	 * @return liquidity LP amount
	 */
	function standardAdd(uint256 tokenAmount, uint256 _wethAmt, address payable to) public returns (uint256) {
		IERC20(_token).safeTransferFrom(msg.sender, address(this), tokenAmount);
		weth.transferFrom(msg.sender, address(this), _wethAmt);
		return _addLiquidity(tokenAmount, _wethAmt, to);
	}

	/**
	 * @notice Add liquidity with RDNT and WETH
	 * @dev use with quote
	 * @param tokenAmount RDNT amount
	 * @param wethAmount WETH amount
	 * @param to LP address to be transfered
	 * @return liquidity LP amount
	 */
	function _addLiquidity(
		uint256 tokenAmount,
		uint256 wethAmount,
		address payable to
	) internal returns (uint256 liquidity) {
		(uint256 wethReserve, uint256 tokenReserve) = getPairReserves();

		uint256 optimalTokenAmount = UniswapV2Library.quote(wethAmount, wethReserve, tokenReserve);

		uint256 optimalWETHAmount;
		if (optimalTokenAmount > tokenAmount) {
			optimalWETHAmount = UniswapV2Library.quote(tokenAmount, tokenReserve, wethReserve);
			optimalTokenAmount = tokenAmount;
		} else optimalWETHAmount = wethAmount;

		assert(weth.transfer(_tokenWETHPair, optimalWETHAmount));
		IERC20(_token).safeTransfer(_tokenWETHPair, optimalTokenAmount);

		liquidity = IUniswapV2Pair(_tokenWETHPair).mint(to);

		//refund dust
		if (tokenAmount > optimalTokenAmount) IERC20(_token).safeTransfer(to, tokenAmount.sub(optimalTokenAmount));
		if (wethAmount > optimalWETHAmount) {
			weth.transfer(to, wethAmount.sub(optimalWETHAmount));
		}
	}

	/**
	 * @notice LP token amount entitled with ETH
	 * @param ethAmt ETH amount
	 * @return liquidity LP amount
	 */
	function getLPTokenPerEthUnit(uint256 ethAmt) public view returns (uint256 liquidity) {
		(uint256 reserveWeth, uint256 reserveTokens) = getPairReserves();
		uint256 outTokens = UniswapV2Library.getAmountOut(ethAmt.div(2), reserveWeth, reserveTokens);
		uint256 _totalSupply = IUniswapV2Pair(_tokenWETHPair).totalSupply();

		(address token0, ) = UniswapV2Library.sortTokens(address(weth), _token);
		(uint256 amount0, uint256 amount1) = token0 == _token ? (outTokens, ethAmt.div(2)) : (ethAmt.div(2), outTokens);
		(uint256 _reserve0, uint256 _reserve1) = token0 == _token
			? (reserveTokens, reserveWeth)
			: (reserveWeth, reserveTokens);
		liquidity = Math.min(amount0.mul(_totalSupply) / _reserve0, amount1.mul(_totalSupply) / _reserve1);
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
}
