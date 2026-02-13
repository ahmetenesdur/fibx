import type { Address } from "viem";
import { requireSession } from "../wallet/session.js";
import { publicClient } from "../chain/viem.js";
import { getChainConfig } from "../chain/chains.js";
import { ACTIVE_NETWORK } from "../utils/config.js";
import { getTokens } from "../fibrous/tokens.js";
import { getBalances } from "../fibrous/balances.js";
import { formatAmount } from "../utils/parseAmount.js";
import { outputResult, outputError, withSpinner, type OutputOptions } from "../format/output.js";

export async function balanceCommand(opts: OutputOptions): Promise<void> {
	try {
		const chain = getChainConfig(ACTIVE_NETWORK);
		const session = requireSession();
		const wallet = session.walletAddress as Address;

		// 1. Fetch all supported tokens
		const tokensMap = await getTokens();
		const tokenList = Object.values(tokensMap);

		const balances = await withSpinner(
			"Fetching balances...",
			async () => {
				// 2. Parallel fetch: Native ETH + All Token Balances
				const [ethBalance, tokenBalances] = await Promise.all([
					publicClient.getBalance({ address: wallet }),
					getBalances(tokenList, wallet),
				]);

				return {
					eth: formatAmount(ethBalance, 18),
					tokens: tokenBalances,
				};
			},
			opts
		);

		// 3. Prepare Output
		const result: Record<string, string> = {};

		// Always show ETH first
		result["ETH"] = balances.eth;

		// 4. Filter and Map Tokens
		for (const item of balances.tokens) {
			// Filter out zero balances
			// item.balance is a string string from the API, e.g., "0.0" or "10.5"
			const balanceVal = parseFloat(item.balance);
			if (balanceVal > 0) {
				// Try to find the symbol for the token
				const tokenAddr = item.token.address.toLowerCase();
				const token = tokenList.find((t) => t.address.toLowerCase() === tokenAddr);
				const symbol = token ? token.symbol : tokenAddr; // Fallback to address if symbol not found

				result[symbol] = item.balance;
			}
		}

		outputResult(
			{
				wallet: session.walletAddress,
				chain: chain.name,
				...result,
			},
			opts
		);
	} catch (error) {
		outputError(error, opts);
	}
}
