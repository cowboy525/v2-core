// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;
pragma abicoder v2;

import "../radiant/staking/MultiFeeDistribution.sol";

contract MockMFD is MultiFeeDistribution {
	function relock() external override {
		return;
	}

	function setRelock(bool _status) external override {
		autoRelockDisabled[msg.sender] = true;
	}
}
