// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IBounty {
	function quote(address _param) external returns (uint256 bounty);

	function claim(address _param) external returns (uint256 bounty);

	function minDLPBalance() external view returns (uint256 minDLPBalance);

	function onRelockUpdate(
		address _user,
		bool oldStatus,
		bool newStatus
	) external;
}
