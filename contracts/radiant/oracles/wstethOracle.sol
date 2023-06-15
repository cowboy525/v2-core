pragma solidity ^0.8.0;
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../../interfaces/IChainlinkAggregator.sol";
import "../../interfaces/AggregatorV3Interface.sol";
import "../../interfaces/IBaseOracle.sol";

/// @notice Provides wstETH/USD price using stETH/USD Chainlink oracle and wstETH/stETH exchange rate provided by stETH smart contract
contract WSTETHOracle is OwnableUpgradeable {
	AggregatorV3Interface public stETHUSDOracle;
	AggregatorV3Interface public stEthPerWstETHOracle;

	constructor() {
        _disableInitializers();
    }

	function initialize(address _stETHUSDOracle, address _stEthPerWstETHOracle) public initializer {
		stETHUSDOracle = AggregatorV3Interface(_stETHUSDOracle); //8 decimals
		stEthPerWstETHOracle = AggregatorV3Interface(_stEthPerWstETHOracle); //18 decimals
		__Ownable_init();
	}

	function decimals() external view returns (uint8) {
		return 8;
	}

	function description() external view returns (string memory) {
		return "WSTETH/USD";
	}

	function latestTimestamp() external view returns (uint256) {
		(
			,
			,
			,
			//uint80 roundId
			//int256 answer
			//uint256 startedAt
			uint256 updatedAt, //uint256 answeredInRound

		) = stETHUSDOracle.latestRoundData();
		return updatedAt;
	}

	/// @notice Get wstETH/ETH price. It does not check Chainlink oracle staleness! If staleness check needed, it's recommended to use latestTimestamp() function
	/// @return answer wstETH/ETH price or 0 if failure
	function latestAnswer() external view returns (int256 answer) {
		(
			,
			//uint80 roundId
			int256 stETHPrice, //uint256 startedAt //uint256 updatedAt //uint256 answeredInRound
			,
			,

		) = stETHUSDOracle.latestRoundData();

		(
			,
			//uint80 roundId
			int256 wstETHRatio, //uint256 startedAt //uint256 updatedAt //uint256 answeredInRound
			,
			,

		) = stEthPerWstETHOracle.latestRoundData();

		answer = (stETHPrice * wstETHRatio) / 1 ether;
	}

	function version() external view returns (uint256) {
		return 1;
	}
}
