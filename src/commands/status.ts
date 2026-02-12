import { loadSession } from "../wallet/session.js";
import { checkHealth } from "../fibrous/health.js";
import { BASE_CHAIN_ID } from "../utils/config.js";
import { outputResult, outputError, withSpinner, type OutputOptions } from "../format/output.js";

export async function statusCommand(opts: OutputOptions): Promise<void> {
	try {
		const session = loadSession();

		const fibrousHealth = await withSpinner(
			"Checking Fibrous API...",
			async () => {
				try {
					const health = await checkHealth();
					return { ok: true, message: health.message };
				} catch {
					return { ok: false, message: "unreachable" };
				}
			},
			opts
		);

		outputResult(
			{
				chain: "base",
				chainId: BASE_CHAIN_ID,
				authenticated: !!session,
				wallet: session?.walletAddress ?? null,
				fibrous: fibrousHealth,
			},
			opts
		);
	} catch (error) {
		outputError(error, opts);
	}
}
