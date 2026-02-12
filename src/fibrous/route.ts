import { FIBROUS_BASE_URL, FIBROUS_NETWORK, DEFAULT_SLIPPAGE } from "../utils/config.js";
import { ErrorCode, FibxError } from "../utils/errors.js";

export interface RouteToken {
	name: string;
	address: string;
	decimals: number;
	price: number;
}

export interface SwapParameter {
	token_in: string;
	token_out: string;
	rate: string;
	protocol_id: string;
	pool_address: string;
}

export interface RouteAndCallDataResponse {
	route: {
		success: boolean;
		inputToken: RouteToken;
		outputToken: RouteToken;
		inputAmount: string;
		outputAmount: string;
	};
	calldata: {
		route: {
			token_in: string;
			token_out: string;
			amount_in: string;
			amount_out: string;
			min_received: string;
			destination: string;
		};
		swap_parameters: SwapParameter[];
	};
	router_address: string;
}

export interface RouteParams {
	amount: string; // Base units (wei etc.)
	tokenInAddress: string;
	tokenOutAddress: string;
	slippage?: number;
	destination: string;
}

export async function getRouteAndCallData(params: RouteParams): Promise<RouteAndCallDataResponse> {
	const slippage = params.slippage ?? DEFAULT_SLIPPAGE;

	const url = new URL(`${FIBROUS_BASE_URL}/${FIBROUS_NETWORK}/v2/routeAndCallData`);
	url.searchParams.set("amount", params.amount);
	url.searchParams.set("tokenInAddress", params.tokenInAddress);
	url.searchParams.set("tokenOutAddress", params.tokenOutAddress);
	url.searchParams.set("slippage", slippage.toString());
	url.searchParams.set("destination", params.destination);

	try {
		const res = await fetch(url.toString());

		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new Error(`HTTP ${res.status}: ${body}`);
		}

		const data = (await res.json()) as RouteAndCallDataResponse;

		if (!data.route?.success) {
			throw new FibxError(ErrorCode.ROUTE_NOT_FOUND, "No route found for this swap pair");
		}

		return data;
	} catch (error) {
		if (error instanceof FibxError) throw error;
		throw new FibxError(
			ErrorCode.FIBROUS_ERROR,
			`Route fetch failed: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}
