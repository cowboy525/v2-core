// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma abicoder v2;

import "../radiant/staking/MultiFeeDistribution.sol";

contract MockNewMultiFeeDistribution is MultiFeeDistribution {
	function mockNewFunction() external pure returns (bool) {
		return true;
	}
}
