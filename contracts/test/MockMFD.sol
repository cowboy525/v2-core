// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "../radiant/staking/MultiFeeDistribution.sol";

contract MockMFD is MultiFeeDistribution {
	function relock() external pure override {
		return;
	}

	// solc-ignore-next-line unused-param
	function setRelock(bool _status) external override {
		autoRelockDisabled[msg.sender] = true;
	}
}
