// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@layerzerolabs/solidity-examples/contracts/token/oft/v2/OFTV2.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "../../interfaces/IPriceProvider.sol";

contract RadiantOFT is OFTV2, Pausable {
	using SafeMath for uint256;

	address private treasury;
	address private dao;

	/// @notice Divisor for fee ratio, 100%
	uint256 public constant FEE_DIVISOR = 10000;

	/// @notice Fee ratio for bridging
	uint256 public feeRatio;

	/// @notice PriceProvider, for RDNT price in native fee calc
	IPriceProvider public priceProvider;

	/// @notice Emitted when fee ratio is updated
	event FeeUpdated(uint256 _fee);

	/// @notice Emitted when PriceProvider is updated
	event PriceProviderUpdated(IPriceProvider indexed _priceProvider);

	/**
	 * @notice Create RadiantOFT
	 * @param _tokenName token name
	 * @param _symbol token symbol
	 * @param _endpoint LZ endpoint for network
	 * @param _dao DAO address, for initial mint
	 * @param _treasury Treasury address, for fee recieve
	 * @param _mintAmt Mint amount
	 */
	constructor(
		string memory _tokenName,
		string memory _symbol,
		address _endpoint,
		address _dao,
		address _treasury,
		uint256 _mintAmt
	) OFTV2(_tokenName, _symbol, 8, _endpoint) {
		dao = _dao;
		treasury = _treasury;
		if (_mintAmt != 0) {
			_mint(dao, _mintAmt);
		}
	}

	function burn(uint256 _amount) public {
		_burn(_msgSender(), _amount);
	}

	function pause() public onlyOwner {
		_pause();
	}

	function unpause() public onlyOwner {
		_unpause();
	}

	/**
	 * @notice Returns LZ fee + Bridge fee
	 * @dev overrides default OFT estimate fee function to add native fee
	 * @param _dstChainId dest LZ chain id
	 * @param _toAddress to addr on dst chain
	 * @param _amount amount to bridge
	 * @param _useZro use ZRO token, someday ;)
	 * @param _adapterParams LZ adapter params
	 */
	function estimateSendFee(
		uint16 _dstChainId,
		bytes32 _toAddress,
		uint _amount,
		bool _useZro,
		bytes calldata _adapterParams
	) public view override returns (uint nativeFee, uint zroFee) {
		(nativeFee, zroFee) = super.estimateSendFee(_dstChainId, _toAddress, _amount, _useZro, _adapterParams);
		nativeFee = nativeFee.add(getBridgeFee(_amount));
	}

	/**
	 * @notice Returns LZ fee + Bridge fee
	 * @dev overrides default OFT _send function to add native fee
	 * @param _from from addr
	 * @param _dstChainId dest LZ chain id
	 * @param _toAddress to addr on dst chain
	 * @param _amount amount to bridge
	 * @param _refundAddress refund addr
	 * @param _zroPaymentAddress use ZRO token, someday ;)
	 * @param _adapterParams LZ adapter params
	 */
	function _send(
		address _from,
		uint16 _dstChainId,
		bytes32 _toAddress,
		uint _amount,
		address payable _refundAddress,
		address _zroPaymentAddress,
		bytes memory _adapterParams
	) internal override whenNotPaused returns (uint amount) {
		uint256 fee = getBridgeFee(_amount);
		require(msg.value >= fee, "ETH sent is not enough for the fee payment");
		payable(treasury).transfer(fee);

		_checkAdapterParams(_dstChainId, PT_SEND, _adapterParams, NO_EXTRA_GAS);

		(amount, ) = _removeDust(_amount);
		amount = _debitFrom(_from, _dstChainId, _toAddress, amount); // amount returned should not have dust
		require(amount > 0, "OFTCore: amount too small");

		bytes memory lzPayload = _encodeSendPayload(_toAddress, _ld2sd(amount));
		_lzSend(_dstChainId, lzPayload, _refundAddress, _zroPaymentAddress, _adapterParams, msg.value.sub(fee));

		emit SendToChain(_dstChainId, _from, _toAddress, amount);
	}

	/**
	 * @notice overrides default OFT _debitFrom function to make pauseable
	 * @param _from from addr
	 * @param _dstChainId dest LZ chain id
	 * @param _toAddress to addr on dst chain
	 * @param _amount amount to bridge
	 */
	function _debitFrom(
		address _from,
		uint16 _dstChainId,
		bytes32 _toAddress,
		uint _amount
	) internal override whenNotPaused returns (uint) {
		return super._debitFrom(_from, _dstChainId, _toAddress, _amount);
	}

	/**
	 * @notice Bridge fee amount
	 * @param rdntAmount amount for bridge
	 */
	function getBridgeFee(uint256 rdntAmount) public view returns (uint256) {
		if (address(priceProvider) == address(0)) {
			return 0;
		}
		uint256 priceInEth = priceProvider.getTokenPrice();
		uint256 priceDecimals = priceProvider.decimals();
		uint256 rdntInEth = rdntAmount.mul(priceInEth).div(10**priceDecimals).mul(10**18).div(10**decimals());
		return rdntInEth.mul(feeRatio).div(FEE_DIVISOR);
	}

	/**
	 * @notice Set fee info
	 * @param _fee ratio
	 */
	function setFee(uint256 _fee) external onlyOwner {
		require(_fee <= 1e4, "Invalid ratio");
		feeRatio = _fee;
		emit FeeUpdated(_fee);
	}

	/**
	 * @notice Set price provider
	 * @param _priceProvider address
	 */
	function setPriceProvider(IPriceProvider _priceProvider) external onlyOwner {
		priceProvider = _priceProvider;
		emit PriceProviderUpdated(_priceProvider);
	}
}
