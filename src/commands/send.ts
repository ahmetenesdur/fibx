import type { Address } from "viem";
import { requireSession } from "../wallet/session.js";
import { getPrivyClient } from "../wallet/privy.js";
import { getWalletClient } from "../chain/viem.js";
import { getChainConfig } from "../chain/chains.js";
import { encodeTransfer } from "../chain/erc20.js";
import { ACTIVE_NETWORK } from "../utils/config.js";
import { resolveToken } from "../fibrous/tokens.js";
import { validateAddress, validateAmount } from "../utils/validation.js";
import { parseAmount } from "../utils/parseAmount.js";
import { outputResult, outputError, withSpinner, type OutputOptions } from "../format/output.js";

export async function sendCommand(
	amount: string,
	recipient: string,
	tokenSymbol: string,
	opts: OutputOptions
): Promise<void> {
	try {
		validateAmount(amount);
		validateAddress(recipient);

		const chain = getChainConfig(ACTIVE_NETWORK);
		const session = requireSession();
		const privy = getPrivyClient();
		const walletClient = getWalletClient(privy, session);

		let txHash: `0x${string}`;
		let amountBigInt: bigint;
		const isEth = tokenSymbol.toUpperCase() === "ETH";

		if (isEth) {
			// Native ETH Transfer
			amountBigInt = parseAmount(amount, 18);
			txHash = await withSpinner(
				`Sending ${amount} ETH...`,
				async () => {
					return walletClient.sendTransaction({
						to: recipient as Address,
						value: amountBigInt,
						data: undefined,
					});
				},
				opts
			);
		} else {
			// ERC20 Transfer
			const token = await resolveToken(tokenSymbol);
			amountBigInt = parseAmount(amount, token.decimals);
			const data = encodeTransfer(recipient as Address, amountBigInt);

			txHash = await withSpinner(
				`Sending ${amount} ${token.symbol}...`,
				async () => {
					return walletClient.sendTransaction({
						to: token.address as Address,
						data,
						value: 0n,
					});
				},
				opts
			);
		}

		outputResult(
			{
				txHash,
				amount,
				recipient,
				token: isEth ? "ETH" : tokenSymbol.toUpperCase(),
				chain: chain.name,
			},
			opts
		);
	} catch (error) {
		outputError(error, opts);
	}
}
