// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma abicoder v2;

interface IMFDstats {
	struct AddTransferParam {
		address asset;
		uint256 amount;
		address treasury;
	}

	function getTotal() external view returns (uint256);

	function getLastDayTotal() external view returns (uint256);

	function addTransfer(AddTransferParam memory param) external;
}
