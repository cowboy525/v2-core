// SPDX-License-Identifier: MIT

pragma solidity 0.8.12;
pragma abicoder v2;

contract StaticPriceProvider {
	function update() external {}

	function getTokenPrice() public pure returns (uint256) {
		return 100000;
	}

	function decimals() public pure returns (uint256) {
		return 8;
	}
}
