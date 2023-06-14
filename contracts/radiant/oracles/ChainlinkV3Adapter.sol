// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../../dependencies/openzeppelin/upgradeability/Initializable.sol";
import "../../dependencies/openzeppelin/upgradeability/OwnableUpgradeable.sol";
import "../../interfaces/IChainlinkAggregator.sol";
import "../../interfaces/AggregatorV3Interface.sol";
import "../../interfaces/IBaseOracle.sol";

contract ChainlinkV3Adapter is IBaseOracle, AggregatorV3Interface, OwnableUpgradeable {
	AggregatorV3Interface public ethChainlinkFeed;
	AggregatorV3Interface public tokenChainlinkFeed;
	address public token;

	uint256 public ethLatestTimestamp;
	uint256 public tokenLatestTimestamp;

	function initialize(address _token, address _ethChainlinkFeed, address _tokenChainlinkFeed) external initializer {
		require(_token != address(0), "token is 0 address");
		require(_ethChainlinkFeed != address(0), "ethChainlinkFeed is 0 address");
		require(_tokenChainlinkFeed != address(0), "tokenChainlinkFeed is 0 address");
		ethChainlinkFeed = AggregatorV3Interface(_ethChainlinkFeed);
		tokenChainlinkFeed = AggregatorV3Interface(_tokenChainlinkFeed);
		token = _token;
		__Ownable_init();
	}

	function latestAnswer() public view returns (uint256 price) {
		int256 answer = _getAnswer(tokenChainlinkFeed);
		price = uint256(answer);
	}

	function latestAnswerInEth() public view returns (uint256 price) {
		int256 tokenAnswer = _getAnswer(tokenChainlinkFeed);
		int256 ethAnswer = _getAnswer(ethChainlinkFeed);
		price = (uint256(tokenAnswer) * (10 ** 8)) / uint256(ethAnswer);
	}

	function update() public {
		(, , , ethLatestTimestamp, ) = ethChainlinkFeed.latestRoundData();
		(, , , tokenLatestTimestamp, ) = tokenChainlinkFeed.latestRoundData();
	}

	function canUpdate() public view returns (bool) {
		return false;
	}

	function consult() public view returns (uint256 price) {
		return latestAnswer();
	}

	function version() external view returns (uint256) {
		return tokenChainlinkFeed.version();
	}

	function decimals() external view returns (uint8) {
		return tokenChainlinkFeed.decimals();
	}

	function description() external view returns (string memory) {
		return tokenChainlinkFeed.description();
	}

	function getRoundData(
		uint80 _roundId
	)
		external
		view
		returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
	{
		return tokenChainlinkFeed.getRoundData(_roundId);
	}

	function latestRoundData()
		public
		view
		returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
	{
		return tokenChainlinkFeed.latestRoundData();
	}

	function _getAnswer(AggregatorV3Interface chainlinkFeed) internal view returns (int256) {
		(, int256 answer, , uint256 updatedAt, ) = chainlinkFeed.latestRoundData();
		require(updatedAt > 0, "round not complete");
		require(block.timestamp - updatedAt < 86400, "stale price");
		require(answer > 0, "negative price");
		return answer;
	}
}
