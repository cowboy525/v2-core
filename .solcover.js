module.exports = {
	skipFiles: [
		'dependencies/',
		'flashloan/',
		'interfaces/',
		'deployments/',
		'libraries/',
		'misc/',
		'mocks/',
		'oft/layerzero/',
		'protocol/',
		'test/',
		'lock/',
		'staking/MerkleDistributor.sol',
		'uniswap/',
	],
	// solcOptimizerDetails: {
	//     peephole: false,
	//     inliner: false,
	//     jumpdestRemover: false,
	//     orderLiterals: true,  // <-- TRUE! Stack too deep when false
	//     deduplicate: false,
	//     cse: false,
	//     constantOptimizer: false,
	//     yul: false
	// }
	configureYulOptimizer: true,
};
