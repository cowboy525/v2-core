// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IBountyable {
	function claimBounty(address _user, bool _execute) external returns (uint256 bountyAmt, bool issueBaseBounty);
}
