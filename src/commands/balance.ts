import type { Address } from "viem";
import { requireSession } from "../wallet/session.js";
import { publicClient } from "../chain/viem.js";
import { getChainConfig } from "../chain/chains.js";
import { getERC20Balance } from "../chain/erc20.js";
import { ACTIVE_NETWORK } from "../utils/config.js";
import { resolveToken } from "../fibrous/tokens.js";
import { formatAmount } from "../utils/parseAmount.js";
import { outputResult, outputError, withSpinner, type OutputOptions } from "../format/output.js";

export async function balanceCommand(opts: OutputOptions): Promise<void> {
	try {
		const chain = getChainConfig(ACTIVE_NETWORK);
		const session = requireSession();
		const wallet = session.walletAddress as Address;

		const usdc = await resolveToken("USDC");

		const balances = await withSpinner(
			"Fetching balances...",
			async () => {
				const [ethBalance, usdcBalance] = await Promise.all([
					publicClient.getBalance({ address: wallet }),
					getERC20Balance(usdc.address as Address, wallet),
				]);

				return {
					eth: formatAmount(ethBalance, 18),
					usdc: formatAmount(usdcBalance, usdc.decimals),
				};
			},
			opts
		);

		outputResult(
			{
				wallet: session.walletAddress,
				chain: chain.name,
				eth: balances.eth,
				usdc: balances.usdc,
			},
			opts
		);
	} catch (error) {
		outputError(error, opts);
	}
}
