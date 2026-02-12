import { PrivyClient } from "@privy-io/node";
import { ErrorCode, FibxError } from "../utils/errors.js";

export function getPrivyClient(): PrivyClient {
	const appId = process.env.PRIVY_APP_ID;
	const appSecret = process.env.PRIVY_APP_SECRET;

	if (!appId || !appSecret) {
		throw new FibxError(
			ErrorCode.PRIVY_ERROR,
			"PRIVY_APP_ID and PRIVY_APP_SECRET env vars are required"
		);
	}

	return new PrivyClient({ appId, appSecret });
}

export async function createAgentWallet(privy: PrivyClient, publicKey: string) {
	try {
		const wallet = await privy.wallets().create({
			chain_type: "ethereum",
			owner: { public_key: publicKey },
		});
		return { id: wallet.id, address: wallet.address };
	} catch (error) {
		throw new FibxError(
			ErrorCode.PRIVY_ERROR,
			`Failed to create wallet: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}
