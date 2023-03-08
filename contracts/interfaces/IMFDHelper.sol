// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma abicoder v2;

import "./IFeeDistribution.sol";

interface IMFDHelper {
	function getUnderlying(address token) external view returns (address underlying);

	function getLendingPool() external view returns (address);

	function getRewardToBaseRoute(address token) external view returns (address[] memory);

	function getRouteToRdnt() external view returns (address[] memory routeToRdnt);

	function quoteSelfCompound() external view returns (uint256 tokensOut);

	function getIneligibleRewards(
		IFeeDistribution.RewardData[] memory pendingRewards,
		LockedBalance[] memory locks,
		uint256 lastClaimTime
	) external view returns (IFeeDistribution.RewardData[] memory bounties);
}
