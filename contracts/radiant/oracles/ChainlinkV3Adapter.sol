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

	error AddressZero();

	error InvalidPrice();

	function initialize(address _token, address _ethChainlinkFeed, address _tokenChainlinkFeed) external initializer {
		if (_token == address(0)) revert AddressZero();
		if (_ethChainlinkFeed == address(0)) revert AddressZero();
		if (_tokenChainlinkFeed == address(0)) revert AddressZero();
		ethChainlinkFeed = AggregatorV3Interface(_ethChainlinkFeed);
		tokenChainlinkFeed = AggregatorV3Interface(_tokenChainlinkFeed);
		token = _token;
		__Ownable_init();
	}

	function latestAnswer() public view returns (uint256 price) {
		(, int256 answer, , , ) = tokenChainlinkFeed.latestRoundData();
		if (answer <= 0) revert InvalidPrice();
		price = uint256(answer);
	}

	function latestAnswerInEth() public view returns (uint256 price) {
		(, int256 tokenAnswer, , , ) = tokenChainlinkFeed.latestRoundData();
		(, int256 ethAnswer, , , ) = ethChainlinkFeed.latestRoundData();
		if (tokenAnswer <= 0 || ethAnswer <= 0) revert InvalidPrice();
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
}
