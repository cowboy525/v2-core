// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;
pragma abicoder v2;

import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IBaseOracle} from "../../interfaces/IBaseOracle.sol";
import {IPoolHelper} from "../../interfaces/IPoolHelper.sol";
import {IChainlinkAggregator} from "../../interfaces/IChainlinkAggregator.sol";
import {IEligibilityDataProvider} from "../../interfaces/IEligibilityDataProvider.sol";

/// @title PriceProvider Contract
/// @author Radiant
contract PriceProvider is Initializable, OwnableUpgradeable {
	using SafeMath for uint256;

	/// @notice Chainlink aggregator for USD price of base token
	IChainlinkAggregator public baseTokenPriceInUsdProxyAggregator;

	/// @notice Pool helper contract - Uniswap/Balancer
	IPoolHelper public poolHelper;

	/// @notice Eligibility data provider contract
	IEligibilityDataProvider public eligibilityProvider;

	/// @notice Base oracle contract
	IBaseOracle public oracle;

	bool private usePool;

	error AddressZero();

	error InvalidOracle();

	/********************** Events ***********************/

	event OracleUpdated(address indexed _newOracle);

	event PoolHelperUpdated(address indexed _poolHelper);

	event AggregatorUpdated(address indexed _baseTokenPriceInUsdProxyAggregator);
	
	event UsePoolUpdated(bool indexed _usePool);
	
	constructor() {
		_disableInitializers();
	}

	/**
	 * @notice Initializer
	 * @param _baseTokenPriceInUsdProxyAggregator Chainlink aggregator for USD price of base token
	 * @param _poolHelper Pool helper contract - Uniswap/Balancer
	 */
	function initialize(
		IChainlinkAggregator _baseTokenPriceInUsdProxyAggregator,
		IPoolHelper _poolHelper
	) public initializer {
		if (address(_baseTokenPriceInUsdProxyAggregator) == (address(0))) revert AddressZero();
		if (address(_poolHelper) == (address(0))) revert AddressZero();
		__Ownable_init();

		poolHelper = _poolHelper;
		baseTokenPriceInUsdProxyAggregator = _baseTokenPriceInUsdProxyAggregator;
		usePool = true;
	}

	/**
	 * @notice Update oracles.
	 */
	function update() public {
		if (address(oracle) != address(0) && oracle.canUpdate()) {
			oracle.update();
		}
	}

	/**
	 * @notice Returns the latest price in eth.
	 */
	function getTokenPrice() public view returns (uint256 priceInEth) {
		if (usePool) {
			// use sparingly, TWAP/CL otherwise
			priceInEth = poolHelper.getPrice();
		} else {
			priceInEth = oracle.latestAnswerInEth();
		}
	}

	/**
	 * @notice Returns the latest price in USD.
	 */
	function getTokenPriceUsd() public view returns (uint256 price) {
		if (usePool) {
			// use sparingly, TWAP/CL otherwise
			uint256 ethPrice = uint256(IChainlinkAggregator(baseTokenPriceInUsdProxyAggregator).latestAnswer());
			uint256 priceInEth = poolHelper.getPrice();
			price = priceInEth.mul(ethPrice).div(10 ** 8);
		} else {
			price = oracle.latestAnswer();
		}
	}

	/**
	 * @notice Returns lp token price in ETH.
	 */
	function getLpTokenPrice() public view returns (uint256) {
		// decis 8
		uint256 rdntPriceInEth = getTokenPrice();
		return poolHelper.getLpPrice(rdntPriceInEth);
	}

	/**
	 * @notice Returns lp token price in USD.
	 */
	function getLpTokenPriceUsd() public view returns (uint256 price) {
		// decimals 8
		uint256 lpPriceInEth = getLpTokenPrice();
		// decimals 8
		uint256 ethPrice = uint256(baseTokenPriceInUsdProxyAggregator.latestAnswer());
		price = lpPriceInEth.mul(ethPrice).div(10 ** 8);
	}

	/**
	 * @notice Returns lp token address.
	 */
	function getLpTokenAddress() public view returns (address) {
		return poolHelper.lpTokenAddr();
	}

	/**
	 * @notice Sets new oracle.
	 */
	function setOracle(address _newOracle) external onlyOwner {
		if (_newOracle == address(0)) revert AddressZero();
		oracle = IBaseOracle(_newOracle);
		emit OracleUpdated(_newOracle);
	}

	/**
	 * @notice Sets pool heler contract.
	 */
	function setPoolHelper(address _poolHelper) external onlyOwner {
		poolHelper = IPoolHelper(_poolHelper);
		if (getLpTokenPrice() == 0) revert InvalidOracle();
		emit PoolHelperUpdated(_poolHelper);
	}

	/**
	 * @notice Sets base token price aggregator.
	 */
	function setAggregator(address _baseTokenPriceInUsdProxyAggregator) external onlyOwner {
		baseTokenPriceInUsdProxyAggregator = IChainlinkAggregator(_baseTokenPriceInUsdProxyAggregator);
		if (getLpTokenPriceUsd() == 0) revert InvalidOracle();
		emit AggregatorUpdated(_baseTokenPriceInUsdProxyAggregator);
	}

	/**
	 * @notice Sets option to use pool.
	 */
	function setUsePool(bool _usePool) external onlyOwner {
		usePool = _usePool;
		emit UsePoolUpdated(_usePool);
	}

	/**
	 * @notice Returns decimals of price.
	 */
	function decimals() public pure returns (uint256) {
		return 8;
	}
}
