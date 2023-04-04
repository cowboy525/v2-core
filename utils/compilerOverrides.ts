import {SolcUserConfig} from 'hardhat/types';

export const generateCompilerOverrides = () => {
	let overrides: Record<string, SolcUserConfig> = {};

	let excludes = [
		'contracts/test/uniswap/UniswapV2OracleLibrary.sol',
		'contracts/test/uniswap/UniswapV2Library.sol',
		'contracts/test/uniswap/UQ112x112.sol',
		'contracts/test/uniswap/SafeMath.sol',
		'contracts/test/uniswap/periphery/UniswapV2Router02.sol',
		'contracts/test/uniswap/periphery/UniswapV2Router01.sol',
		'contracts/test/uniswap/core/UniswapV2Pair.sol',
		'contracts/test/uniswap/core/UniswapV2Factory.sol',
		'contracts/test/uniswap/core/UniswapV2ERC20.sol',
		'contracts/test/uniswap/periphery/test/RouterEventEmitter.sol',
		'contracts/test/uniswap/periphery/test/DeflatingERC20.sol',
		'contracts/test/uniswap/periphery/libraries/UniswapV2LiquidityMathLibrary.sol',
		'contracts/test/uniswap/periphery/libraries/UniswapV2Library.sol',
		'contracts/test/uniswap/periphery/libraries/TransferHelper.sol',
		'contracts/test/uniswap/periphery/libraries/SafeMath.sol',
		'contracts/test/uniswap/periphery/interfaces/IWETH.sol',
		'contracts/test/uniswap/periphery/interfaces/IUniswapV2Router02.sol',
		'contracts/test/uniswap/periphery/interfaces/IUniswapV2Router01.sol',
		'contracts/test/uniswap/periphery/interfaces/IUniswapV2Migrator.sol',
		'contracts/test/uniswap/periphery/interfaces/IERC20.sol',
		'contracts/test/uniswap/core/libraries/UQ112x112.sol',
		'contracts/test/uniswap/core/libraries/SafeMath.sol',
		'contracts/test/uniswap/core/libraries/Math.sol',
		'contracts/test/uniswap/core/libraries/FullMath.sol',
		'contracts/test/uniswap/core/libraries/FixedPoint.sol',
		'contracts/test/uniswap/core/libraries/BitMath.sol',
		'contracts/test/uniswap/core/libraries/Babylonian.sol',
		'contracts/test/uniswap/core/interfaces/IUniswapV2Pair.sol',
		'contracts/test/uniswap/core/interfaces/IUniswapV2Factory.sol',
		'contracts/test/uniswap/core/interfaces/IUniswapV2ERC20.sol',
		'contracts/test/uniswap/core/interfaces/IUniswapV2Callee.sol',
		'contracts/test/uniswap/core/interfaces/IERC20.sol',
		'contracts/test/uniswap/periphery/interfaces/V1/IUniswapV1Factory.sol',
		'contracts/test/uniswap/periphery/interfaces/V1/IUniswapV1Exchange.sol',
		'contracts/test/uniswap/periphery/libraries/FullMath.sol',
	];

	for (const contract of excludes) {
		overrides[contract] = {
			version: '0.6.6',
		};
	}

	return overrides;
};
