import { getPrivyClient } from "../../services/privy/client.js";
import { outputResult, outputError, withSpinner, type OutputOptions } from "../../lib/format.js";

interface PrivyWallet {
	address: string;
	id: string;
	chain_type: string;
	connector_type: string;
	first_verified_at: number | null;
}

export async function walletsCommand(email: string, opts: OutputOptions): Promise<void> {
	try {
		const privy = getPrivyClient();

		const user = await withSpinner(
			`Fetching wallets for ${email}...`,
			async () => privy.users().getByEmailAddress({ address: email }),
			opts
		);

		const wallets = user.linked_accounts.filter(
			(a) => (a.type === "wallet" || a.type === "smart_wallet") && "id" in a
		) as unknown as PrivyWallet[];

		if (wallets.length === 0) {
			outputResult({ message: "No wallets found for this user." }, opts);
			return;
		}

		// Format for output
		const walletList = wallets.map((w) => ({
			address: w.address,
			id: w.id,
			chainType: w.chain_type,
			connectorType: w.connector_type,
			firstVerifiedAt: w.first_verified_at
				? new Date(w.first_verified_at * 1000).toISOString()
				: "N/A",
		}));

		if (opts.json) {
			console.log(JSON.stringify(walletList, null, 2));
		} else {
			console.log(`Found ${wallets.length} wallet(s):`);
			walletList.forEach((w) => {
				console.log(`\nAddress: ${w.address}`);
				console.log(`ID:      ${w.id}`);
				console.log(`Created: ${w.firstVerifiedAt}`);
				console.log(`Type:    ${w.connectorType} (${w.chainType})`);
			});
		}
	} catch (error) {
		outputError(error, opts);
	}
}
