// SPDX-License-Identifier: MIT

pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockPoolHelper {
	function getLpPrice() external pure returns (uint256) {
		return 42;
	}
}
