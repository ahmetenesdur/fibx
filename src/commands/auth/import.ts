import { outputResult, outputError, withSpinner, type OutputOptions } from "../../lib/format.js";
import { saveSession } from "../../services/auth/session.js";
import { privateKeyToAccount } from "viem/accounts";
import { type Hex } from "viem";
import chalk from "chalk";
import inquirer from "inquirer";

export async function authImportCommand(opts: OutputOptions): Promise<void> {
	try {
		const { privateKey } = await inquirer.prompt([
			{
				type: "password",
				name: "privateKey",
				message: "Enter your private key (0x...):",
				validate: (input: string) => {
					if (!/^0x[a-fA-F0-9]{64}$/.test(input)) {
						return "Invalid private key format. Must start with 0x and be 66 chars long.";
					}
					return true;
				},
			},
		]);

		const account = privateKeyToAccount(privateKey as Hex);
		const address = account.address;

		await withSpinner(
			"Saving session...",
			async () => {
				saveSession({
					userId: "local-user",
					walletAddress: address,
					createdAt: new Date().toISOString(),
					type: "private-key",
					privateKey: privateKey,
				});
			},
			opts
		);

		outputResult(
			{
				message: "Private key imported successfully!",
				address: address,
				type: "private-key",
			},
			opts
		);

		console.log(
			chalk.yellow(
				"\n⚠️  Security Warning: Your private key is stored locally in session.json."
			)
		);
		console.log(chalk.yellow("    Make sure your machine is secure."));
	} catch (error) {
		outputError(error, opts);
	}
}
