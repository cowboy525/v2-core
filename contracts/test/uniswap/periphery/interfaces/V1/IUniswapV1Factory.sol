// SPDX-License-Identifier: agpl-3.0
pragma solidity >=0.5.0;

interface IUniswapV1Factory {
    function getExchange(address) external view returns (address);
}
