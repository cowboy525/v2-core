// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.12;
pragma experimental ABIEncoderV2;

interface ILockZap {
	function zap(
		bool _borrow,
		uint256 _wethAmt,
		uint256 _rdntAmt,
		uint256 _lockTypeIndex,
		uint256 _slippage
	) external returns (uint256 liquidity);

	function zapOnBehalf(
		bool _borrow,
		uint256 _wethAmt,
		uint256 _rdntAmt,
		address _onBehalf,
		uint256 _slippage
	) external returns (uint256 liquidity);
}
