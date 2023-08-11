// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

/// @title MockBountyManager Contract
/// @author Radiant Devs
/// @dev All function calls are currently implemented without side effects
contract MockBountyManager {
	/**
	 * @notice Minimum locked lp balance
	 */
	function minDLPBalance() public pure returns (uint256 min) {
		min = 1000000;
	}
}
