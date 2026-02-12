import { createPublicClient, createWalletClient, http, toHex } from "viem";
import type { PrivyClient } from "@privy-io/node";

import type { Session } from "../wallet/session.js";
import { ACTIVE_NETWORK } from "../utils/config.js";
import { getChainConfig } from "./chains.js";

const chain = getChainConfig(ACTIVE_NETWORK);

export const publicClient = createPublicClient({
	chain: chain.viemChain,
	transport: http(chain.rpcUrl),
});

// Custom Viem Account implementation that wraps Privy Server API
function toPrivyViemAccount(privy: PrivyClient, walletId: string, address: string) {
	return {
		address: address as `0x${string}`,
		type: "local" as const,
		source: "privy" as const,
		publicKey: address as `0x${string}`, // This is technically incorrect but sufficient for most viem operations that don't need the public key explicitly
		async signTransaction(transaction: Record<string, unknown>) {
			const { chainId, ...txParams } = transaction;

			// Map Viem transaction to Privy format
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const privyTx: any = {
				chain_id: toHex(chainId as number),
				to: txParams.to,
				data: txParams.data,
				value: txParams.value ? toHex(txParams.value as bigint) : undefined,
				nonce: txParams.nonce ? toHex(txParams.nonce as number) : undefined,
				gas_limit: txParams.gas ? toHex(txParams.gas as bigint) : undefined,
				max_fee_per_gas: txParams.maxFeePerGas
					? toHex(txParams.maxFeePerGas as bigint)
					: undefined,
				max_priority_fee_per_gas: txParams.maxPriorityFeePerGas
					? toHex(txParams.maxPriorityFeePerGas as bigint)
					: undefined,
				type: txParams.type === "eip1559" ? 2 : txParams.type === "legacy" ? 0 : undefined,
			};

			Object.keys(privyTx).forEach(
				(key) => (privyTx as any)[key] === undefined && delete (privyTx as any)[key]
			);

			const rpcInput: any = {
				params: { transaction: privyTx },
				method: "eth_signTransaction",
			};

			const response = await privy.wallets().ethereum().signTransaction(walletId, rpcInput);
			return response.signed_transaction as `0x${string}`;
		},

		async signMessage({
			message,
		}: {
			message: { raw: string | Uint8Array } | string | Uint8Array;
		}) {
			let messageContent: string | Uint8Array;
			if (typeof message === "object" && "raw" in message) {
				messageContent = message.raw;
			} else {
				messageContent = message as string | Uint8Array;
			}

			const rpcInput: any = {
				message: messageContent,
			};

			const response = await privy.wallets().ethereum().signMessage(walletId, rpcInput);
			return response.signature as `0x${string}`;
		},

		async signTypedData(typedData: Record<string, unknown>) {
			const rpcInput: any = {
				...typedData,
			};

			const response = await privy.wallets().ethereum().signTypedData(walletId, rpcInput);
			return response.signature as `0x${string}`;
		},
	};
}

export function getWalletClient(privy: PrivyClient, session: Session) {
	const account = toPrivyViemAccount(privy, session.walletId, session.walletAddress);

	return createWalletClient({
		account,
		chain: chain.viemChain,
		transport: http(chain.rpcUrl),
	});
}
