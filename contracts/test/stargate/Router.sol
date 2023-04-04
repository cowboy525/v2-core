// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.12;
pragma abicoder v2;

import "./IStargateRouter.sol";

contract MockRouter is IStargateRouter {
	constructor() {}

	function swap(
		uint16 _dstChainId,
		uint256 _srcPoolId,
		uint256 _dstPoolId,
		address payable _refundAddress,
		uint256 _amountLD,
		uint256 _minAmountLD,
		lzTxObj memory _lzTxParams,
		bytes calldata _to,
		bytes calldata _payload
	) external payable override {}

	function quoteLayerZeroFee(
		uint16,
		uint8,
		bytes calldata,
		bytes calldata,
		MockRouter.lzTxObj memory
	) external pure override returns (uint256, uint256) {
		return (1, 2);
	}
}
