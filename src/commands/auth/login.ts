import { getPrivyClient } from "../../services/privy/client.js";
import { outputResult, outputError, withSpinner, type OutputOptions } from "../../lib/format.js";

export async function authLoginCommand(email: string, opts: OutputOptions): Promise<void> {
	try {
		getPrivyClient();

		await withSpinner(
			"Sending OTP...",
			async () => {
				const appId = process.env.PRIVY_APP_ID!;
				const appSecret = process.env.PRIVY_APP_SECRET!;
				const credentials = Buffer.from(`${appId}:${appSecret}`).toString("base64");

				const res = await fetch("https://auth.privy.io/api/v1/passwordless/init", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Basic ${credentials}`,
						"privy-app-id": appId,
					},
					body: JSON.stringify({ email }),
				});

				if (!res.ok) {
					const body = await res.text().catch(() => "");
					throw new Error(`OTP init failed (${res.status}): ${body}`);
				}

				return res.json();
			},
			opts
		);

		outputResult(
			{
				email,
				message: `OTP sent to ${email}. Run: fibx auth verify ${email} <code>`,
			},
			opts
		);
	} catch (error) {
		outputError(error, opts);
	}
}
