import {LP_PROVIDER} from '../types';

export const getInitLpAmts = (
	lpPlatform: LP_PROVIDER,
	lpInitEth: number,
	ethPrice: number,
	targetPrice: number
): any => {
	let initRdnt = (lpInitEth * ethPrice) / targetPrice;

	if (lpPlatform === LP_PROVIDER.BALANCER) {
		initRdnt *= 4;
	}
	return Math.round(initRdnt);
};
