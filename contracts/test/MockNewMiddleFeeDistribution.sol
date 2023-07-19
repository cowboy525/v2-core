// SPDX-License-Identifier: MIT

pragma solidity 0.8.12;

import "../radiant/staking/MiddleFeeDistribution.sol";

contract MockNewMiddleFeeDistribution is MiddleFeeDistribution {
	function mockNewFunction() external pure returns (bool) {
		return true;
	}
}
