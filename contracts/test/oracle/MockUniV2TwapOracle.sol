// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

contract MockUniV2TwapOracle {
	function canUpdate() public view returns (bool) {
		return true;
	}

	function update() external {}

	// assumes 18 decimal token
	// returns USD price in decimal 8
	function latestAnswer() public view returns (uint256 price) {
		return 10 * 8;
	}

	function latestAnswerInEth() public view returns (uint256 price) {
		return 10 * 8;
	}
}
