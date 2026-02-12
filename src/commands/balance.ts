import type { Address } from "viem";
import { requireSession } from "../wallet/session.js";
import { publicClient } from "../chain/viem.js";
import { getERC20Balance } from "../chain/erc20.js";
import { USDC_ADDRESS, USDC_DECIMALS, ETH_DECIMALS } from "../utils/config.js";
import { formatAmount } from "../utils/parseAmount.js";
import { outputResult, outputError, withSpinner, type OutputOptions } from "../format/output.js";

export async function balanceCommand(opts: OutputOptions): Promise<void> {
	try {
		const session = requireSession();
		const wallet = session.walletAddress as Address;

		const balances = await withSpinner(
			"Fetching balances...",
			async () => {
				const [ethBalance, usdcBalance] = await Promise.all([
					publicClient.getBalance({ address: wallet }),
					getERC20Balance(USDC_ADDRESS, wallet),
				]);

				return {
					eth: formatAmount(ethBalance, ETH_DECIMALS),
					usdc: formatAmount(usdcBalance, USDC_DECIMALS),
				};
			},
			opts
		);

		outputResult(
			{
				wallet: session.walletAddress,
				eth: balances.eth,
				usdc: balances.usdc,
			},
			opts
		);
	} catch (error) {
		outputError(error, opts);
	}
}
