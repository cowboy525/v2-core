// SPDX-License-Identifier: MIT

pragma solidity 0.8.12;

contract MockChainlinkAggregator {
	int256 price;

	constructor(int256 _price) {
		price = _price;
	}

	function latestAnswer() external view returns (int256) {
		return price;
	}

	function decimals() external pure returns (int256) {
		return 8;
	}

	function setPrice(int256 _price) external {
		price = _price;
	}
}
