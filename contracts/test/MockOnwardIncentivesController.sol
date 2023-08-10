// SPDX-License-Identifier: MIT

pragma solidity 0.8.12;

import "../radiant/staking/ChefIncentivesController.sol";
import "../interfaces/IOnwardIncentivesController.sol";

contract MockOnwardIncentivesController is IOnwardIncentivesController {
	function handleAction(address _token, address _user, uint256 _balance, uint256 _totalSupply) external override {}
}
