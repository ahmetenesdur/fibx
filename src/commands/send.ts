import type { Address } from "viem";
import { requireSession } from "../wallet/session.js";
import { getPrivyClient } from "../wallet/privy.js";
import { getWalletClient } from "../chain/viem.js";
import { encodeTransfer } from "../chain/erc20.js";
import { USDC_ADDRESS, USDC_DECIMALS } from "../utils/config.js";
import { validateAddress, validateAmount } from "../utils/validation.js";
import { parseAmount } from "../utils/parseAmount.js";
import { outputResult, outputError, withSpinner, type OutputOptions } from "../format/output.js";

export async function sendCommand(
	amount: string,
	recipient: string,
	opts: OutputOptions
): Promise<void> {
	try {
		validateAmount(amount);
		validateAddress(recipient);

		const session = requireSession();
		const privy = getPrivyClient();
		const walletClient = getWalletClient(privy, session);

		const amountBigInt = parseAmount(amount, USDC_DECIMALS);
		const data = encodeTransfer(recipient as Address, amountBigInt);

		const hash = await withSpinner(
			`Sending ${amount} USDC...`,
			async () => {
				return walletClient.sendTransaction({
					to: USDC_ADDRESS,
					data,
					value: 0n,
				});
			},
			opts
		);

		outputResult(
			{
				txHash: hash,
				amount,
				recipient,
				token: "USDC",
				chain: "base",
			},
			opts
		);
	} catch (error) {
		outputError(error, opts);
	}
}
