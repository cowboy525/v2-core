// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface mockERC20 is IERC20 {
	function mint(uint256 amount) external;
}
