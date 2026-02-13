import type { Address } from "viem";
import { requireSession } from "../../services/auth/session.js";
import { publicClient } from "../../services/chain/client.js";
import { getChainConfig } from "../../services/chain/constants.js";
import { ACTIVE_NETWORK } from "../../lib/config.js";
import { getTokens } from "../../services/fibrous/tokens.js";
import { getBalances } from "../../services/fibrous/balances.js";
import { formatAmount } from "../../lib/parseAmount.js";
import { outputResult, outputError, withSpinner, type OutputOptions } from "../../lib/format.js";

export async function balanceCommand(opts: OutputOptions): Promise<void> {
	try {
		const chain = getChainConfig(ACTIVE_NETWORK);
		const session = requireSession();
		const wallet = session.walletAddress as Address;

		const tokensMap = await getTokens();
		const tokenList = Object.values(tokensMap);

		const balances = await withSpinner(
			"Fetching balances...",
			async () => {
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

		const result: Record<string, string> = {};

		// Always show ETH first
		result["ETH"] = balances.eth;

		for (const item of balances.tokens) {
			const balanceVal = parseFloat(item.balance);
			if (balanceVal > 0) {
				const tokenAddr = item.token.address.toLowerCase();
				const token = tokenList.find((t) => t.address.toLowerCase() === tokenAddr);
				const symbol = token ? token.symbol : tokenAddr;

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
