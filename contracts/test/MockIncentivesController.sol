// SPDX-License-Identifier: MIT

pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockIncentivesController {
	function beforeLockUpdate(address user) external {}

	function afterLockUpdate(address user) external {}

	function addPool(address _token, uint256 _allocPoint) external {}

	function claim(address _user, address[] calldata _tokens) external {}
}
