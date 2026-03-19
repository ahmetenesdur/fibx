import chalk from "chalk";
import { getPortfolio, type Portfolio } from "../../services/portfolio/portfolio.js";
import { outputError, withSpinner, type OutputOptions } from "../../lib/format.js";

function formatUsd(value: number): string {
	return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function printPortfolio(portfolio: Portfolio): void {
	const shortAddr = `${portfolio.wallet.slice(0, 6)}...${portfolio.wallet.slice(-4)}`;
	console.log();
	console.log(chalk.bold(`Portfolio — ${shortAddr}`));
	console.log(chalk.dim("═".repeat(52)));

	for (const chain of portfolio.chains) {
		console.log();
		console.log(chalk.cyan.bold(`  ${chain.chain}`));
		console.log(chalk.dim("  " + "─".repeat(48)));

		for (const asset of chain.assets) {
			const symbol = asset.symbol.padEnd(10);
			const balance = parseFloat(asset.balance).toFixed(4).padStart(14);
			const usd = formatUsd(asset.usdValue).padStart(14);
			console.log(`  ${chalk.white(symbol)} ${chalk.dim(balance)} ${chalk.green(usd)}`);
		}

		console.log(chalk.dim(" ".repeat(26) + "──────────────"));
		console.log(
			`${" ".repeat(14)}${chalk.dim("Chain Total")} ${chalk.bold(formatUsd(chain.totalUsd).padStart(14))}`
		);
	}

	if (portfolio.defi.length > 0) {
		console.log();
		for (const pos of portfolio.defi) {
			console.log(chalk.magenta.bold(`  DeFi — ${pos.protocol} (${pos.chain})`));
			console.log(chalk.dim("  " + "─".repeat(48)));

			console.log(
				`  ${"Collateral".padEnd(24)} ${chalk.green(formatUsd(pos.collateralUsd).padStart(14))}`
			);
			console.log(
				`  ${"Debt".padEnd(24)} ${chalk.red(("-" + formatUsd(pos.debtUsd)).padStart(14))}`
			);

			const hf = parseFloat(pos.healthFactor);
			const hfStr = hf > 100 ? "Safe (>100)" : hf.toFixed(2);
			const hfColor = hf > 2 ? chalk.green : hf > 1.2 ? chalk.yellow : chalk.red;
			console.log(`  ${"Health Factor".padEnd(24)} ${hfColor(hfStr.padStart(14))}`);

			console.log(chalk.dim(" ".repeat(26) + "──────────────"));
			const netColor = pos.netUsd >= 0 ? chalk.green : chalk.red;
			console.log(
				`${" ".repeat(14)}${chalk.dim("Net Position")} ${chalk.bold(netColor(formatUsd(pos.netUsd).padStart(14)))}`
			);
		}
	}

	console.log();
	console.log(chalk.dim("═".repeat(52)));
	console.log(
		`${" ".repeat(10)}${chalk.bold("Total Portfolio")} ${chalk.bold.green(formatUsd(portfolio.totalUsd).padStart(14))}`
	);
	console.log();
}

export async function portfolioCommand(opts: OutputOptions): Promise<void> {
	try {
		const portfolio = await withSpinner(
			"Fetching portfolio across all chains...",
			async () => getPortfolio(),
			opts
		);

		if (opts.json) {
			console.log(JSON.stringify(portfolio, null, 2));
		} else {
			printPortfolio(portfolio);
		}
	} catch (error) {
		outputError(error, opts);
	}
}
