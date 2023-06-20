// SPDX-License-Identifier: MIT

pragma solidity 0.8.12;


import "../radiant/zap/helpers/BalancerPoolHelper.sol";

contract TestBalancerPoolHelper is BalancerPoolHelper {
	// outToken is RDNT
	function sell(uint256 _amount) public returns (uint256 amountOut) {
		IAsset tokenInAddress = IAsset(inTokenAddr);
		IAsset tokenOutAddress = IAsset(outTokenAddr);

		bytes32 _poolId = IWeightedPool(lpTokenAddr).getPoolId();

		bytes memory userDataEncoded = abi.encode(); //https://dev.balancer.fi/helpers/encoding
		IVault.SingleSwap memory singleSwapRequest = IVault.SingleSwap(
			_poolId,
			IVault.SwapKind.GIVEN_IN,
			tokenInAddress,
			tokenOutAddress,
			_amount,
			userDataEncoded
		);
		IVault.FundManagement memory fundManagementRequest = IVault.FundManagement(
			address(this),
			false,
			payable(address(this)),
			false
		);

		uint256 limit = 0;

		amountOut = IVault(vaultAddr).swap(
			singleSwapRequest,
			fundManagementRequest,
			limit,
			(block.timestamp + 3 minutes)
		);
		// return swap(_amount, outTokenAddr, inTokenAddr, lpTokenAddr);
	}
}
