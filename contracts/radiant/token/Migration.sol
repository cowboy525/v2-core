// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/// @title Migration contract from V1 to V2
/// @author Radiant team
/// @dev All function calls are currently implemented without side effects
contract Migration is Ownable, Pausable {
	using SafeMath for uint256;
	using SafeERC20 for ERC20;

	/// @notice V1 of RDNT
	ERC20 public tokenV1;

	/// @notice V2 of RDNT
	ERC20 public tokenV2;

	/// @notice Exchange rate in bips; if V1:V2 is 10:1 then, 10 * 1e4
	uint256 public exchangeRate;

	/// @notice Any user exchanging tokens will fix the exchange rate
	bool public isExchangeRateFixed;

	/// @notice emitted when exchange rate is updated
	event ExchangeRateUpdated(uint256 exchangeRate);

	/// @notice emitted when migrate v1 token into v2
	event Migrate(address indexed user, uint256 amountV1, uint256 amountV2);

	/**
	 * @notice constructor
	 * @param _tokenV1 RDNT V1 token address
	 * @param _tokenV2 RDNT V2 token address
	 */
	constructor(ERC20 _tokenV1, ERC20 _tokenV2) Ownable() {
		tokenV1 = _tokenV1;
		tokenV2 = _tokenV2;

		exchangeRate = 1e4;

		_pause();
	}

	/**
	 * @notice Sets exchange rate
	 * @param _exchangeRate from V1 to V2
	 */
	function setExchangeRate(uint256 _exchangeRate) external onlyOwner {
		require(!isExchangeRateFixed, "Users already exchanged tokens");
		exchangeRate = _exchangeRate;
		emit ExchangeRateUpdated(_exchangeRate);
	}

	/**
	 * @notice Withdraw ERC20 token
	 * @param token address for withdraw
	 * @param amount to withdraw
	 * @param to target address
	 */
	function withdrawToken(
		ERC20 token,
		uint256 amount,
		address to
	) external onlyOwner {
		token.safeTransfer(to, amount);
	}

	/**
	 * @notice Pause or Unpause migration
	 * @param pause or unpause, true for pause
	 */
	function pauseMigration(bool pause) external onlyOwner {
		pause ? _pause() : _unpause();
	}

	/**
	 * @notice Migrate from V1 to V2
	 * @param amount of V1 token
	 */
	function exchange(uint256 amount) external whenNotPaused {
		if (!isExchangeRateFixed) {
			isExchangeRateFixed = true;
		}
		uint256 v1Decimals = tokenV1.decimals();
		uint256 v2Decimals = tokenV2.decimals();

		uint256 outAmount = amount.mul(1e4).div(exchangeRate).mul(10**v2Decimals).div(10**v1Decimals);
		tokenV1.safeTransferFrom(_msgSender(), address(this), amount);
		tokenV2.safeTransfer(_msgSender(), outAmount);

		emit Migrate(_msgSender(), amount, outAmount);
	}
}
