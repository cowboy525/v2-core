// SPDX-License-Identifier: MIT

pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CustomERC20 is ERC20 {
	constructor(uint256 amount) ERC20("Custom", "Custom") {
		_mint(msg.sender, amount);
	}

	function setMinter(address minter) external returns (bool) {}

	function mint(address receiver, uint256 amount) external returns (bool successful) {
		_mint(receiver, amount);
		return true;
	}

	function burn(uint256 amount) external returns (bool successful) {
		_burn(msg.sender, amount);
		return true;
	}
}
