// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma abicoder v2;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../dependencies/openzeppelin/upgradeability/Initializable.sol";
import "../../dependencies/openzeppelin/upgradeability/OwnableUpgradeable.sol";
import "../../interfaces/IAaveOracle.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../../interfaces/IChainlinkAggregator.sol";
import {IMultiFeeDistribution} from "../../interfaces/IMultiFeeDistribution.sol";
import {IMiddleFeeDistribution} from "../../interfaces/IMiddleFeeDistribution.sol";

contract MFDstats is Initializable, OwnableUpgradeable {
	using SafeMath for uint256;

	address private _aaveOracle;
	address private _emissionsReserve;
	address private _mfd;

	struct MFDTransfer {
		uint256 timestamp;
		uint256 usdValue;
		uint256 lpUsdValue;
	}

	struct AssetAddresses {
		uint256 count;
		mapping(uint256 => address) assetAddress;
		mapping(uint256 => string) assetSymbol;
		mapping(address => uint256) indexOfAddress;
	}

	struct TrackPerAsset {
		address assetAddress;
		string assetSymbol;
		uint256 usdValue;
		uint256 lpUsdValue;
	}

	struct AddTransferParam {
		address asset;
		uint256 amount;
		address treasury;
	}

	AssetAddresses private allAddresses;

	mapping(address => uint256) private _totalPerAsset;
	mapping(address => uint256) private _lpTotalPerAsset;
	mapping(address => MFDTransfer[]) private mfdTransfersPerAsset;

	IMiddleFeeDistribution public middleFee;

	uint256 public constant DAY_SECONDS = 86400;
	uint8 public constant DECIMALS = 18;
	uint256 public constant RATIO_DIVISOR = 10000;

	address[] public vests;

	event NewTransferAdded(address indexed asset, uint256 usdValue, uint256 lpUsdValue);

	function initialize(address aaveOracle, address emissionsReserve) public initializer {
		_aaveOracle = aaveOracle;
		_emissionsReserve = emissionsReserve;
		__Ownable_init();
	}

	function getPriceDecimal(address assetAddress) external view returns (uint8) {
		address sourceOfAsset = IAaveOracle(_aaveOracle).getSourceOfAsset(assetAddress);
		uint8 priceDecimal = IChainlinkAggregator(sourceOfAsset).decimals();
		return priceDecimal;
	}

	function setMiddleFee(IMiddleFeeDistribution _middleFee) external onlyOwner {
		middleFee = _middleFee;
	}

	function addTransfer(AddTransferParam memory param) external {
		require(middleFee.isRewardToken(msg.sender), "!rToken");

		uint256 lpLockingRewardRatio = IMiddleFeeDistribution(param.treasury).lpLockingRewardRatio();
		uint256 operationExpenseRatio = IMiddleFeeDistribution(param.treasury).operationExpenseRatio();
		address operationExpenses = IMiddleFeeDistribution(param.treasury).operationExpenses();
		uint256 assetPrice = IAaveOracle(_aaveOracle).getAssetPrice(param.asset);
		address sourceOfAsset = IAaveOracle(_aaveOracle).getSourceOfAsset(param.asset);

		if (operationExpenses != address(0) && operationExpenseRatio > 0) {
			uint256 opExAmount = param.amount.mul(operationExpenseRatio).div(RATIO_DIVISOR);
			param.amount = param.amount.sub(opExAmount);
		}
		uint8 priceDecimal = IChainlinkAggregator(sourceOfAsset).decimals();
		uint8 assetDecimals = IERC20Metadata(param.asset).decimals();
		uint256 usdValue = assetPrice.mul(param.amount).mul(10**DECIMALS).div(10**priceDecimal).div(10**assetDecimals);
		uint256 lpUsdValue = usdValue.mul(lpLockingRewardRatio).div(RATIO_DIVISOR);
		usdValue = usdValue.sub(lpUsdValue);

		uint256 index;

		if (allAddresses.indexOfAddress[param.asset] == 0) {
			allAddresses.count++;
			allAddresses.assetAddress[allAddresses.count] = param.asset;
			allAddresses.assetSymbol[allAddresses.count] = IERC20Metadata(param.asset).symbol();
			allAddresses.indexOfAddress[param.asset] = allAddresses.count;
		}
		_totalPerAsset[param.asset] = _totalPerAsset[param.asset].add(usdValue);
		_lpTotalPerAsset[param.asset] = _lpTotalPerAsset[param.asset].add(lpUsdValue);

		for (uint256 i = 0; i < mfdTransfersPerAsset[param.asset].length; i++) {
			if (block.timestamp.sub(mfdTransfersPerAsset[param.asset][i].timestamp) <= DAY_SECONDS) {
				index = i;
				break;
			}
		}

		for (uint256 i = index; i < mfdTransfersPerAsset[param.asset].length; i++) {
			mfdTransfersPerAsset[param.asset][i - index] = mfdTransfersPerAsset[param.asset][i];
		}

		for (uint256 i = 0; i < index; i++) {
			mfdTransfersPerAsset[param.asset].pop();
		}

		mfdTransfersPerAsset[param.asset].push(MFDTransfer(block.timestamp, usdValue, lpUsdValue));

		emit NewTransferAdded(param.asset, usdValue, lpUsdValue);
	}

	function getTotal() external view returns (TrackPerAsset[] memory) {
		TrackPerAsset[] memory totalPerAsset = new TrackPerAsset[](allAddresses.count + 1);
		uint256 total;
		uint256 lpTotal;
		for (uint256 i = 1; i <= allAddresses.count; i++) {
			total = total.add(_totalPerAsset[allAddresses.assetAddress[i]]);
			lpTotal = lpTotal.add(_lpTotalPerAsset[allAddresses.assetAddress[i]]);

			totalPerAsset[i] = TrackPerAsset(
				allAddresses.assetAddress[i],
				allAddresses.assetSymbol[i],
				_totalPerAsset[allAddresses.assetAddress[i]],
				_lpTotalPerAsset[allAddresses.assetAddress[i]]
			);
		}
		totalPerAsset[0] = TrackPerAsset(address(0), "", total, lpTotal);
		return totalPerAsset;
	}

	function getLastDayTotal() external view returns (TrackPerAsset[] memory) {
		TrackPerAsset[] memory lastDayTotalPerAsset = new TrackPerAsset[](allAddresses.count + 1);
		uint256 lastdayTotal;
		uint256 lpLastDayTotal;

		for (uint256 i = 1; i <= allAddresses.count; i++) {
			uint256 assetLastDayTotal;
			uint256 lpAssetLastDayTotal;

			assert(mfdTransfersPerAsset[allAddresses.assetAddress[i]].length > 0);
			for (uint256 j = mfdTransfersPerAsset[allAddresses.assetAddress[i]].length.sub(1); ; j--) {
				if (
					block.timestamp.sub(mfdTransfersPerAsset[allAddresses.assetAddress[i]][j].timestamp) <= DAY_SECONDS
				) {
					assetLastDayTotal = assetLastDayTotal.add(
						mfdTransfersPerAsset[allAddresses.assetAddress[i]][j].usdValue
					);
					lpAssetLastDayTotal = lpAssetLastDayTotal.add(
						mfdTransfersPerAsset[allAddresses.assetAddress[i]][j].lpUsdValue
					);
				} else {
					break;
				}
				if (j == 0) break;
			}

			lastdayTotal = lastdayTotal.add(assetLastDayTotal);
			lpLastDayTotal = lpLastDayTotal.add(lpAssetLastDayTotal);
			lastDayTotalPerAsset[i] = TrackPerAsset(
				allAddresses.assetAddress[i],
				allAddresses.assetSymbol[i],
				assetLastDayTotal,
				lpAssetLastDayTotal
			);
		}

		lastDayTotalPerAsset[0] = TrackPerAsset(address(0), "", lastdayTotal, lpLastDayTotal);

		return lastDayTotalPerAsset;
	}

	function calcBalanceSum(
		address daoTreasuryAddress,
		address chef,
		address migration,
		address bountyManager,
		address mfd,
		address emissionsReserve
	) internal view returns (uint256) {
		IERC20 rdnt = IERC20(middleFee.getRdntTokenAddress());
		uint256 daoBalance = rdnt.balanceOf(daoTreasuryAddress);
		uint256 chefBalance = rdnt.balanceOf(chef);
		uint256 migrationBalance = rdnt.balanceOf(migration);
		uint256 bountyBalance = rdnt.balanceOf(bountyManager);
		// mfd balance
		uint256 mfdLockedBalance = rdnt.balanceOf(mfd);
		uint256 emissionsReserveBalance = rdnt.balanceOf(emissionsReserve);

		return daoBalance + chefBalance + migrationBalance + bountyBalance + mfdLockedBalance + emissionsReserveBalance;
	}

	function calcVestsBalances() internal view returns (uint256) {
		uint256 total;
		IERC20 rdnt = IERC20(middleFee.getRdntTokenAddress());
		for (uint256 i = 0; i < vests.length; i++) {
			total = total.add(rdnt.balanceOf(vests[i]));
		}
		return total;
	}

	function getCirculatingSupply(
		address _chef,
		address _bountyManager,
		address _migration
	) external view returns (uint256) {
		IMultiFeeDistribution mfd = IMultiFeeDistribution(middleFee.getMultiFeeDistributionAddress());
		IMultiFeeDistribution lpMfd = IMultiFeeDistribution(middleFee.getLPFeeDistributionAddress());
		IERC20 rdnt = IERC20(middleFee.getRdntTokenAddress());

		address daoTreasuryAddress = mfd.daoTreasury();
		uint256 balanceSum = calcBalanceSum(
			daoTreasuryAddress,
			_chef,
			_migration,
			_bountyManager,
			address(mfd),
			_emissionsReserve
		);
		uint256 vestsBal = calcVestsBalances();
		// lp fee distribution balance
		IERC20 lpToken = IERC20(lpMfd.stakingToken());
		uint256 lockedLPAmount = lpToken.balanceOf(address(lpMfd));
		uint256 lpTotalSupply = lpToken.totalSupply();
		uint256 lpfdLockedBalance;

		(uint256 reserve0, uint256 reserve1, ) = IUniswapV2Pair(address(lpToken)).getReserves();
		if (IUniswapV2Pair(address(lpToken)).token0() == address(rdnt)) {
			lpfdLockedBalance = (reserve0 * lockedLPAmount) / lpTotalSupply;
		} else {
			lpfdLockedBalance = (reserve1 * lockedLPAmount) / lpTotalSupply;
		}
		//total supply
		uint256 totalSupply = rdnt.totalSupply();
		uint256 totalBalance = lpfdLockedBalance.add(balanceSum).add(vestsBal);
		if (totalSupply >= totalBalance) return totalSupply.sub(totalBalance);
		else return 0;
	}

	function addVest(address _vest) external onlyOwner {
		vests.push(_vest);
	}
}
