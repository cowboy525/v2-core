// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import {AggregatorV3Interface} from "../../interfaces/AggregatorV3Interface.sol";

/// @title Library for oracle utilities
/// @author Radiant Devs
library Oracle {
	/// @notice The period for price update, this is taken from heartbeats of chainlink price feeds
	uint256 public constant UPDATE_PERIOD = 86400;

	error RoundNotComplete();

	error StalePrice();

	error InvalidPrice();

	/**
	 * @notice Get latest answer from chainlink feed
	 * @param chainlinkFeed aggregator address
	 * @return Answer
	 */
	function getAnswer(AggregatorV3Interface chainlinkFeed) internal view returns (int256) {
		(, int256 answer, , uint256 updatedAt, ) = chainlinkFeed.latestRoundData();
		if(updatedAt == 0) revert RoundNotComplete();
		if(block.timestamp - updatedAt >= UPDATE_PERIOD) revert StalePrice();
		if(answer <= 0) revert InvalidPrice();
		return answer;
	}
}
