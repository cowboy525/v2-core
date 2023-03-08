// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "./BaseOracle.sol";
import "../../interfaces/IBaseOracle.sol";
import "../../dependencies/openzeppelin/upgradeability/Initializable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/// @title ComboOracle Contract
/// @author Radiant
/// @dev Returns average of multiple oracle sources, if TWAP, use same period
contract ComboOracle is Initializable, BaseOracle {
	using SafeMath for uint256;

	/// @notice Array of different oracles
	IBaseOracle[] public sources;

	/**
	 * @notice Initializer
	 * @param _rdnt RDNT token address.
	 * @param _ethChainlinkFeed chainlink price feed for ETH.
	 */
	function initialize(address _rdnt, address _ethChainlinkFeed) external initializer {
		__BaseOracle_init(_rdnt, _ethChainlinkFeed);
	}

	/**
	 * @notice Adds new oracle
	 * @param _source New price source.
	 */
	function addSource(address _source) public onlyOwner {
		require(_source != address(0));
		sources.push(IBaseOracle(_source));
	}

	/**
	 * @notice Calculated price
	 * @return price Average price of several sources.
	 */
	function consult() public view override returns (uint256 price) {
		require(sources.length != 0);

		uint256 sum;
		uint256 lowestPrice;
		for (uint256 i = 0; i < sources.length; i++) {
			uint256 price = sources[i].consult();
			require(price != 0, "source consult failure");
			if (lowestPrice == 0) {
				lowestPrice = price;
			} else {
				lowestPrice = lowestPrice > price ? price : lowestPrice;
			}
			sum = sum.add(price);
		}
		price = sum.div(sources.length);
		price = price > ((lowestPrice * 1025) / 1000) ? lowestPrice : price;
	}
}
