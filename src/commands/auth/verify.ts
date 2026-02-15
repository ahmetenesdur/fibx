import {
	getPrivyClient,
	createAgentWallet,
	findExistingWallet,
	saveWalletIdToUser,
} from "../../services/privy/client.js";
import { saveSession } from "../../services/auth/session.js";
import { outputResult, outputError, withSpinner, type OutputOptions } from "../../lib/format.js";

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
				return { userId: data.user.id, userToken: data.privy_access_token };
			},
			opts
		);

		// Check for existing wallet
		const existingWallet = await withSpinner(
			"Checking for existing wallet...",
			async () => findExistingWallet(privy, email),
			opts
		);

		let wallet: { id: string; address: string };
		let isExisting: boolean;

		if (existingWallet) {
			wallet = existingWallet;
			isExisting = true;
		} else {
			// Create new server wallet
			wallet = await withSpinner(
				"Creating server wallet...",
				async () => createAgentWallet(privy),
				opts
			);

			// Link wallet to user
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
			type: "privy",
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
