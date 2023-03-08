// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma abicoder v2;

import "./LockedBalance.sol";
import {IFeeDistribution} from "./IMultiFeeDistribution.sol";

interface IMiddleFeeDistribution is IFeeDistribution {
	function forwardReward(address[] memory _rewardTokens) external;

	function getMFDstatsAddress() external view returns (address);

	function lpLockingRewardRatio() external view returns (uint256);

	function getRdntTokenAddress() external view returns (address);

	function getLPFeeDistributionAddress() external view returns (address);

	function getMultiFeeDistributionAddress() external view returns (address);

	function operationExpenseRatio() external view returns (uint256);

	function operationExpenses() external view returns (address);

	function isRewardToken(address) external view returns (bool);
}
