import { generateP256KeyPair } from "@privy-io/node";
import { getPrivyClient, createAgentWallet } from "../wallet/privy.js";
import { saveSession } from "../wallet/session.js";
import { outputResult, outputError, withSpinner, type OutputOptions } from "../format/output.js";

export async function authVerifyCommand(
	email: string,
	code: string,
	opts: OutputOptions
): Promise<void> {
	try {
		const privy = getPrivyClient();

		const userId = await withSpinner(
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

				const data = (await res.json()) as { user: { id: string } };
				return data.user.id;
			},
			opts
		);

		// Generate P-256 authorization key pair BEFORE wallet creation
		// generateP256KeyPair() returns keys in base64 DER format, ready for Privy API
		const { privateKey: authorizationPrivateKey, publicKey: authorizationPublicKey } =
			await generateP256KeyPair();

		const wallet = await withSpinner(
			"Creating wallet...",
			async () => createAgentWallet(privy, authorizationPublicKey),
			opts
		);

		await saveSession({
			userId,
			walletId: wallet.id,
			walletAddress: wallet.address as `0x${string}`,
			authorizationPublicKey,
			createdAt: new Date().toISOString(),
		});

		outputResult(
			{
				walletAddress: wallet.address,
				walletId: wallet.id,
				authorizationPrivateKey,
				message:
					"Save the authorizationPrivateKey above as PRIVY_AUTHORIZATION_KEY in your .env file.",
			},
			opts
		);
	} catch (error) {
		outputError(error, opts);
	}
}
