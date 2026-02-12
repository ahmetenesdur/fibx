import { createPublicClient, createWalletClient, http } from "viem";
import { base } from "viem/chains";
import type { PrivyClient } from "@privy-io/node";
import { createViemAccount } from "@privy-io/node/viem";
import type { Session } from "../wallet/session.js";
import { BASE_RPC_URL } from "../utils/config.js";
import { ErrorCode, FibxError } from "../utils/errors.js";

export const publicClient = createPublicClient({
	chain: base,
	transport: http(BASE_RPC_URL),
});

export function getWalletClient(privy: PrivyClient, session: Session) {
	const authKey = process.env.PRIVY_AUTHORIZATION_KEY;
	if (!authKey) {
		throw new FibxError(ErrorCode.PRIVY_ERROR, "PRIVY_AUTHORIZATION_KEY env var is required");
	}

	const account = createViemAccount(privy, {
		walletId: session.walletId,
		address: session.walletAddress as `0x${string}`,
		authorizationContext: {
			authorization_private_keys: [authKey],
		},
	});

	return createWalletClient({
		account,
		chain: base,
		transport: http(BASE_RPC_URL),
	});
}
