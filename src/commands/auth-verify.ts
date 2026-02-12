import {
	getPrivyClient,
	createAgentWallet,
	findExistingWallet,
	saveWalletIdToUser,
} from "../wallet/privy.js";
import { saveSession } from "../wallet/session.js";
import { outputResult, outputError, withSpinner, type OutputOptions } from "../format/output.js";

interface PrivyAuthResponse {
	user: { id: string };
	privy_access_token: string;
}

export async function authVerifyCommand(
	email: string,
	code: string,
	opts: OutputOptions
): Promise<void> {
	try {
		const privy = getPrivyClient();

		const { userId, userToken } = await withSpinner(
			"Verifying OTP...",
			async () => {
				const appId = process.env.PRIVY_APP_ID!;
				const appSecret = process.env.PRIVY_APP_SECRET!;
				const credentials = Buffer.from(`${appId}:${appSecret}`).toString("base64");

				const res = await fetch("https://auth.privy.io/api/v1/passwordless/authenticate", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Basic ${credentials}`,
						"privy-app-id": appId,
					},
					body: JSON.stringify({ email, code }),
				});

				if (!res.ok) {
					const body = await res.text().catch(() => "");
					throw new Error(`OTP verify failed (${res.status}): ${body}`);
				}

				const data = (await res.json()) as PrivyAuthResponse;
				// Return access token (privy_access_token) for session
				return { userId: data.user.id, userToken: data.privy_access_token };
			},
			opts
		);

		// Check if user already has a wallet (checks server wallet metadata first)
		const existingWallet = await withSpinner(
			"Checking for existing wallet...",
			async () => findExistingWallet(privy, email),
			opts
		);

		let wallet: { id: string; address: string };
		let isExisting: boolean;

		if (existingWallet) {
			// Reuse existing wallet
			wallet = existingWallet;
			isExisting = true;
		} else {
			// Create new SERVER wallet (no owner) for the user
			wallet = await withSpinner(
				"Creating server wallet...",
				async () => createAgentWallet(privy), // No owner argument = Server Wallet
				opts
			);

			// Persist the server wallet ID to the user's metadata
			await withSpinner(
				"Linking wallet to user...",
				async () => saveWalletIdToUser(privy, userId, wallet.id),
				opts
			);

			isExisting = false;
		}

		await saveSession({
			userId,
			walletId: wallet.id,
			walletAddress: wallet.address as `0x${string}`,
			userJwt: userToken,
			createdAt: new Date().toISOString(),
		});

		outputResult(
			{
				walletAddress: wallet.address,
				walletId: wallet.id,
				message: isExisting
					? "Existing wallet found and connected. You're ready to go!"
					: "New wallet created and session saved. You're ready to go!",
			},
			opts
		);
	} catch (error) {
		outputError(error, opts);
	}
}
