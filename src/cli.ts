#!/usr/bin/env node

import { Command } from "commander";
import { statusCommand } from "./commands/status.js";
import { authLoginCommand } from "./commands/auth-login.js";
import { authVerifyCommand } from "./commands/auth-verify.js";
import { addressCommand } from "./commands/address.js";
import { balanceCommand } from "./commands/balance.js";
import { sendCommand } from "./commands/send.js";
import { tradeCommand } from "./commands/trade.js";

const program = new Command();

program
	.name("fibx")
	.description("Fibrous DeFi CLI for Base — wallet, transfer, swap")
	.version("0.1.0")
	.option("--json", "Output results as JSON", false);

const auth = program.command("auth").description("Authentication commands");

auth.command("login")
	.description("Initiate email OTP login via Privy")
	.argument("<email>", "Email address for OTP login")
	.action(async (email, _opts, cmd) => {
		const globalOpts = cmd.parent!.parent!.opts();
		await authLoginCommand(email, { json: globalOpts.json });
	});

auth.command("verify")
	.description("Verify OTP code and create wallet session")
	.argument("<email>", "Email used for login")
	.argument("<code>", "OTP code from email")
	.action(async (email, code, _opts, cmd) => {
		const globalOpts = cmd.parent!.parent!.opts();
		await authVerifyCommand(email, code, { json: globalOpts.json });
	});

program
	.command("status")
	.description("Check auth status and Fibrous health")
	.action(async (_opts, cmd) => {
		const globalOpts = cmd.parent!.opts();
		await statusCommand({ json: globalOpts.json });
	});

program
	.command("address")
	.description("Show active wallet address")
	.action(async (_opts, cmd) => {
		const globalOpts = cmd.parent!.opts();
		await addressCommand({ json: globalOpts.json });
	});

program
	.command("balance")
	.description("Show ETH and USDC balances")
	.action(async (_opts, cmd) => {
		const globalOpts = cmd.parent!.opts();
		await balanceCommand({ json: globalOpts.json });
	});

program
	.command("send")
	.description("Send USDC to a recipient")
	.argument("<amount>", "Amount of USDC to send")
	.argument("<recipient>", "Recipient address (0x...)")
	.action(async (amount, recipient, _opts, cmd) => {
		const globalOpts = cmd.parent!.opts();
		await sendCommand(amount, recipient, { json: globalOpts.json });
	});

program
	.command("trade")
	.description("Swap tokens via Fibrous")
	.argument("<amount>", "Amount to swap")
	.argument("<from>", "Source token (symbol or address)")
	.argument("<to>", "Destination token (symbol or address)")
	.option("-s, --slippage <number>", "Slippage tolerance", "0.5")
	.action(async (amount, from, to, opts, cmd) => {
		const globalOpts = cmd.parent!.opts();
		await tradeCommand(amount, from, to, {
			json: globalOpts.json,
			slippage: parseFloat(opts.slippage),
		});
	});

program.parseAsync();
