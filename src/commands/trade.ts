import type { Address } from "viem";
import { requireSession } from "../wallet/session.js";
import { getPrivyClient } from "../wallet/privy.js";
import { getWalletClient } from "../chain/viem.js";
import { getChainConfig } from "../chain/chains.js";
import { getAllowance, encodeApprove } from "../chain/erc20.js";
import { resolveToken } from "../fibrous/tokens.js";
import { getRouteAndCallData, encodeSwapCalldata } from "../fibrous/route.js";
import { ACTIVE_NETWORK, DEFAULT_SLIPPAGE } from "../utils/config.js";
import { validateAmount } from "../utils/validation.js";
import { parseAmount, formatAmount } from "../utils/parseAmount.js";
import { outputResult, outputError, withSpinner, type OutputOptions } from "../format/output.js";

interface TradeOptions extends OutputOptions {
	slippage: number;
}

export async function tradeCommand(
	amount: string,
	from: string,
	to: string,
	opts: TradeOptions
): Promise<void> {
	try {
		validateAmount(amount);

		const chain = getChainConfig(ACTIVE_NETWORK);
		const session = requireSession();
		const privy = getPrivyClient();
		const wallet = session.walletAddress as Address;

		const [tokenIn, tokenOut] = await withSpinner(
			"Resolving tokens...",
			async () => Promise.all([resolveToken(from), resolveToken(to)]),
			opts
		);

		const amountBaseUnits = parseAmount(amount, tokenIn.decimals);
		const isNativeInput =
			tokenIn.address.toLowerCase() === chain.nativeTokenAddress.toLowerCase();

		const routeData = await withSpinner(
			"Finding best route...",
			async () => {
				return getRouteAndCallData({
					amount: amountBaseUnits.toString(),
					tokenInAddress: tokenIn.address,
					tokenOutAddress: tokenOut.address,
					slippage: opts.slippage ?? DEFAULT_SLIPPAGE,
					destination: wallet,
				});
			},
			opts
		);

		const routerAddress = routeData.router_address as Address;
		const walletClient = getWalletClient(privy, session);

		if (!isNativeInput) {
			const currentAllowance = await getAllowance(
				tokenIn.address as Address,
				wallet,
				routerAddress
			);

			if (currentAllowance < amountBaseUnits) {
				await withSpinner(
					"Approving token spend...",
					async () => {
						const approveData = encodeApprove(routerAddress, amountBaseUnits);
						return walletClient.sendTransaction({
							to: tokenIn.address as Address,
							data: approveData,
							value: 0n,
						});
					},
					opts
				);
			}
		}

		const hash = await withSpinner(
			`Swapping ${amount} ${tokenIn.symbol} → ${tokenOut.symbol}...`,
			async () => {
				const swapData = encodeSwapCalldata(routeData.calldata);
				return walletClient.sendTransaction({
					to: routerAddress,
					data: swapData,
					value: isNativeInput ? amountBaseUnits : 0n,
				});
			},
			opts
		);

		const outputAmount = formatAmount(BigInt(routeData.route.outputAmount), tokenOut.decimals);

		outputResult(
			{
				txHash: hash,
				amountIn: amount,
				amountOut: outputAmount,
				tokenIn: tokenIn.symbol,
				tokenOut: tokenOut.symbol,
				router: routerAddress,
				chain: chain.name,
			},
			opts
		);
	} catch (error) {
		outputError(error, opts);
	}
}
