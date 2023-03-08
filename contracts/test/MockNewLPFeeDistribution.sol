// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma abicoder v2;

import "../radiant/staking/MFDPlus.sol";

contract MockNewLPFeeDistribution is MFDPlus {
	function mockNewFunction() external pure returns (bool) {
		return true;
	}
}
