// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "@openzeppelin/contracts/access/Ownable.sol";

contract TestAdminOperation is Ownable {
	function test(uint256) external view onlyOwner returns (uint256) {
		return 0x0000000000000000000000000000000000000000000000000000000000000054;
	}
}
