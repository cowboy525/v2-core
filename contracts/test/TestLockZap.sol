// SPDX-License-Identifier: MIT

pragma solidity 0.8.12;


import "../radiant/zap/LockZap.sol";
import "../interfaces/IPoolHelper.sol";

contract TestnetLockZap is LockZap {
	function sell(uint256 _amount) public returns (uint256 ethOut) {
		IERC20(rdntAddr).transferFrom(msg.sender, address(poolHelper), _amount);
		return ITestPoolHelper(address(poolHelper)).sell(_amount);
	}
}
