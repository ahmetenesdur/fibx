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

export async function findExistingWallet(
	privy: PrivyClient,
	email: string
): Promise<{ id: string; address: string } | null> {
	try {
		const user = await privy.users().getByEmailAddress({ address: email });
		const serverWalletId = user.custom_metadata?.server_wallet_id as string | undefined;

		if (serverWalletId) {
			try {
				const wallet = await privy.wallets().get(serverWalletId);
				return { id: wallet.id, address: wallet.address };
			} catch {
				// Server wallet ID exists in metadata but wallet not found (deleted?)
			}
		}

		return null;
	} catch {
		return null;
	}
}

export async function createAgentWallet(
	privy: PrivyClient,
	owner?: { userId?: string; publicKey?: string }
) {
	try {
		let walletOwner;
		if (owner) {
			walletOwner = owner.userId
				? { user_id: owner.userId }
				: { public_key: owner.publicKey! };
		} else {
			walletOwner = null;
		}

		const wallet = await privy.wallets().create({
			chain_type: "ethereum",
			owner: walletOwner,
		});
		return { id: wallet.id, address: wallet.address };
	} catch (error) {
		throw new FibxError(
			ErrorCode.PRIVY_ERROR,
			`Failed to create wallet: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

export async function saveWalletIdToUser(privy: PrivyClient, userId: string, walletId: string) {
	try {
		await privy.users().setCustomMetadata(userId, {
			custom_metadata: {
				server_wallet_id: walletId,
			},
		});
	} catch (error) {
		throw new FibxError(
			ErrorCode.PRIVY_ERROR,
			`Failed to save wallet ID to user metadata: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}
