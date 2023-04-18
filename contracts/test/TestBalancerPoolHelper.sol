// SPDX-License-Identifier: MIT

pragma solidity 0.8.12;
pragma abicoder v2;

import "../radiant/zap/helpers/BalancerPoolHelper.sol";

contract TestBalancerPoolHelper is BalancerPoolHelper {
	// outToken is RDNT
	function sell(uint256 _amount) public returns (uint256 amountOut) {
		return swap(_amount, outTokenAddr, inTokenAddr, lpTokenAddr);
	}
}
