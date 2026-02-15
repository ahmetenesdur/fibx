import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { PrivyClient } from "@privy-io/node";

import type { Session } from "../auth/session.js";
import type { ChainConfig } from "./constants.js";
import { toPrivyViemAccount } from "../privy/account.js";

export function getPublicClient(chain: ChainConfig) {
	return createPublicClient({
		chain: chain.viemChain,
		transport: http(chain.rpcUrl),
	});
}

export function getWalletClient(privy: PrivyClient | null, session: Session, chain: ChainConfig) {
	let account;

	if (session.type === "private-key" && session.privateKey) {
		account = privateKeyToAccount(session.privateKey as `0x${string}`);
	} else {
		// Default to Privy (or if type is missing/explicitly privy)
		if (!privy) throw new Error("Privy client required for privy session type");
		// Fallback for old sessions without type
		const walletId = session.walletId;
		if (!walletId) throw new Error("Wallet ID required for privy session");

		account = toPrivyViemAccount(privy, walletId, session.walletAddress);
	}

	return createWalletClient({
		account,
		chain: chain.viemChain,
		transport: http(chain.rpcUrl),
	});
}
