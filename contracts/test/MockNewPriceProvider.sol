// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma abicoder v2;

import "../radiant/oracles/PriceProvider.sol";

contract MockNewPriceProvider is PriceProvider {
	function mockNewFunction() external pure returns (bool) {
		return true;
	}
}
