import type { Command } from "commander";
import chalk from "chalk";
import { configService } from "../../services/config/config.js";
import { SUPPORTED_CHAINS } from "../../services/chain/constants.js";

export function registerConfigCommands(program: Command) {
	const configCmd = program
		.command("config")
		.description("Manage fibx configuration (RPC URLs, etc.)");

	configCmd
		.command("set-rpc")
		.description("Set a custom RPC URL for a specific chain")
		.argument("<chain>", "Chain name (base, citrea, hyperevm, monad)")
		.argument("<url>", "RPC URL")
		.action((chain, url) => {
			if (!SUPPORTED_CHAINS[chain]) {
				console.error(chalk.red(`Unsupported chain: ${chain}`));
				console.log(
					chalk.gray(`Supported chains: ${Object.keys(SUPPORTED_CHAINS).join(", ")}`)
				);
				process.exit(1);
			}

			try {
				new URL(url); // Validate URL format
			} catch {
				console.error(chalk.red("Invalid URL format."));
				process.exit(1);
			}

			configService.setRpcUrl(chain, url);
			console.log(chalk.green(`Updated RPC for ${chain} to: ${url}`));
		});

	configCmd
		.command("get-rpc")
		.description("Get the current RPC URL for a chain")
		.argument("<chain>", "Chain name")
		.action((chain) => {
			const customUrl = configService.getRpcUrl(chain);
			const defaultUrl = SUPPORTED_CHAINS[chain]?.rpcUrl;

			if (!defaultUrl) {
				console.error(chalk.red(`Unsupported chain: ${chain}`));
				process.exit(1);
			}

			if (customUrl) {
				console.log(chalk.bold("Current (Custom):"), chalk.cyan(customUrl));
				console.log(chalk.gray("Default:"), defaultUrl);
			} else {
				console.log(chalk.bold("Current (Default):"), defaultUrl);
			}
		});

	configCmd
		.command("list")
		.description("List all configuration")
		.action(() => {
			const config = configService.getConfig();
			console.log(chalk.bold("\nCustom RPCs:"));
			if (Object.keys(config.rpcUrls).length === 0) {
				console.log(chalk.gray("  (None set)"));
			} else {
				for (const [chain, url] of Object.entries(config.rpcUrls)) {
					console.log(`  ${chalk.bold(chain)}: ${chalk.cyan(url)}`);
				}
			}
			console.log("");
		});

	configCmd
		.command("reset-rpc")
		.description("Reset custom RPC URL(s) to default")
		.argument("[chain]", "Chain name (omit to reset all)")
		.action((chain?: string) => {
			if (chain) {
				if (!SUPPORTED_CHAINS[chain]) {
					console.error(chalk.red(`Unsupported chain: ${chain}`));
					console.log(
						chalk.gray(`Supported chains: ${Object.keys(SUPPORTED_CHAINS).join(", ")}`)
					);
					process.exit(1);
				}

				const currentUrl = configService.getRpcUrl(chain);
				if (!currentUrl) {
					console.log(
						chalk.yellow(`No custom RPC set for ${chain}. Already using default.`)
					);
					return;
				}

				configService.resetRpcUrl(chain);
				console.log(chalk.green(`Reset RPC for ${chain} to default.`));
			} else {
				const config = configService.getConfig();
				if (Object.keys(config.rpcUrls).length === 0) {
					console.log(chalk.yellow("No custom RPCs set. Already using defaults."));
					return;
				}

				configService.resetAll();
				console.log(chalk.green("All custom RPC URLs have been reset to defaults."));
			}
		});
}
