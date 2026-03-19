import { Command } from "commander";
import { clearSession } from "../../services/auth/session.js";
import { runCommand } from "../../lib/cli-helpers.js";

export const logoutCommand = new Command("logout")
	.description("Log out and clear current session")
	.action(async () => {
		await runCommand(
			"Logging out...",
			"Logged out. Session cleared.",
			"Logout failed",
			async () => {
				clearSession();
			},
			() => {}
		);
	});
