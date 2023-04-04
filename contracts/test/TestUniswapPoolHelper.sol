// SPDX-License-Identifier: MIT

pragma solidity 0.8.12;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../radiant/zap/helpers/UniswapPoolHelper.sol";

contract TestUniswapPoolHelper is UniswapPoolHelper {
	using SafeERC20 for IERC20;

	function swap(uint256 _amount, address, address, address) public returns (uint256 amountOut) {
		IUniswapV2Pair lpToken = IUniswapV2Pair(lpTokenAddr);
		(uint256 reserve0, uint256 reserve1, ) = lpToken.getReserves();

		(address token0, address token1) = UniswapV2Library.sortTokens(address(wethAddr), rdntAddr);

		uint256 reserveWeth = token0 == address(wethAddr) ? reserve0 : reserve1;
		uint256 reserveTokens = token0 == address(wethAddr) ? reserve1 : reserve0;

		uint256 outETH = UniswapV2Library.getAmountOut(_amount, reserveTokens, reserveWeth);

		IERC20(rdntAddr).safeTransfer(lpTokenAddr, _amount);

		IUniswapV2Pair(lpTokenAddr).swap(
			address(wethAddr) == token0 ? outETH : 0,
			address(wethAddr) == token1 ? outETH : 0,
			address(this),
			""
		);

		amountOut = IERC20(address(wethAddr)).balanceOf(address(this));
	}

	function sell(uint256 _amount) public returns (uint256 amountOut) {
		return
			swap(
				_amount,
				0x0000000000000000000000000000000000000000,
				0x0000000000000000000000000000000000000000,
				0x0000000000000000000000000000000000000000
			);
	}
}
