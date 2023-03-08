// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
pragma abicoder v2;

import "../../interfaces/IAToken.sol";
import "../../interfaces/ILendingPoolAddressesProvider.sol";
import "../../interfaces/ILendingPool.sol";
import "../../interfaces/IFeeDistribution.sol";
import "../../interfaces/IMultiFeeDistribution.sol";
import "../../dependencies/openzeppelin/upgradeability/Initializable.sol";
import "../../dependencies/openzeppelin/upgradeability/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/*
 * Helper functions for MFD compounding + bounties
 */
contract MFDHelper is Initializable, OwnableUpgradeable {
	using SafeMath for uint256;

	event RoutesUpdated(address _token, address[] _routes);
	event RewardBaseTokensUpdated(address[] _tokens);

	mapping(address => address[]) public rewardToBaseRoute;
	address public baseToken; // weth
	address public rdnt;
	address public addressProvider;
	address[] public rewardBaseTokens;
	address public mfd;

	function initialize(
		address _baseToken,
		address _rdnt,
		address _addressProvider
	) public initializer {
		__Ownable_init();

		baseToken = _baseToken;
		rdnt = _rdnt;
		addressProvider = _addressProvider;
	}

	function addRewardBaseTokens(address[] memory _tokens) external onlyOwner {
		rewardBaseTokens = _tokens;
		emit RewardBaseTokensUpdated(_tokens);
	}

	function setRoutes(address _token, address[] memory _routes) external onlyOwner {
		rewardToBaseRoute[_token] = _routes;
		emit RoutesUpdated(_token, _routes);
	}

	/**
	 * @notice Bounty amount of user per each reward token
	 * @dev Reward is RDNT and rTokens
	 */
	function getIneligibleRewards(
		IFeeDistribution.RewardData[] memory pendingRewards,
		LockedBalance[] memory locks,
		uint256 lastClaimTime
	) external view returns (IFeeDistribution.RewardData[] memory bounties) {
		uint256 percentOver = _getIneligiblePercent(locks, lastClaimTime);

		bounties = new IFeeDistribution.RewardData[](pendingRewards.length);

		for (uint256 i = 0; i < pendingRewards.length; i++) {
			address token = pendingRewards[i].token;
			uint256 amount = pendingRewards[i].amount;

			bounties[i].token = token;
			// > 100% ineligible time
			if (percentOver > 10000) {
				bounties[i].amount = amount;
			} else {
				bounties[i].amount = amount.mul(percentOver).div(10000);
			}
		}
	}

	/**
	 * @notice Decide ineligble percent of the user
	 */
	function _getIneligiblePercent(LockedBalance[] memory locks, uint256 lastClaimTime)
		internal
		view
		returns (uint256 percentOver)
	{
		uint256 totalLockAMTxTIME;
		uint256 expiredAMTxTIME;

		for (uint256 i = 0; i < locks.length; i++) {
			uint256 startTime = lastClaimTime != 0 ? lastClaimTime : locks[i].unlockTime.sub(locks[i].duration);
			totalLockAMTxTIME += locks[i].amount.mul(block.timestamp - startTime);
			if (locks[i].unlockTime < block.timestamp) {
				uint256 timeDiff = block.timestamp.sub(locks[i].unlockTime);
				expiredAMTxTIME += timeDiff.mul(locks[i].amount);
			}
		}
		if (totalLockAMTxTIME != 0) {
			percentOver = expiredAMTxTIME.mul(10000).div(totalLockAMTxTIME);
		}
	}

	function getLendingPool() external view returns (address) {
		return ILendingPoolAddressesProvider(addressProvider).getLendingPool();
	}

	function getUnderlying(address token) external view returns (address underlying) {
		underlying = IAToken(token).UNDERLYING_ASSET_ADDRESS();
	}

	function getRewardToBaseRoute(address token) external view returns (address[] memory) {
		return rewardToBaseRoute[token];
	}

	function getRouteToRdnt() external view returns (address[] memory routeToRdnt) {
		routeToRdnt = new address[](2);
		routeToRdnt[0] = baseToken;
		routeToRdnt[1] = address(rdnt);
		return routeToRdnt;
	}

	function quoteSelfCompound() external view returns (uint256 tokensOut) {
		(bool success, bytes memory data) = address(mfd).staticcall(
			abi.encodeWithSignature("convertPendingRewardsToWeth(address)", msg.sender)
		);
		require(success);
		tokensOut = abi.decode(data, (uint256));
	}

	function setMFD(address _mfd) external onlyOwner {
		mfd = _mfd;
	}
}
