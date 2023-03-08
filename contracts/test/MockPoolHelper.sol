// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockPoolHelper {
	function getLpPrice() external pure returns (uint256) {
		return 42;
	}
}
