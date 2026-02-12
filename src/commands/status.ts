import { loadSession } from "../wallet/session.js";
import { checkHealth } from "../fibrous/health.js";
import { getChainConfig } from "../chain/chains.js";
import { ACTIVE_NETWORK } from "../utils/config.js";
import { outputResult, outputError, withSpinner, type OutputOptions } from "../format/output.js";

export async function statusCommand(opts: OutputOptions): Promise<void> {
	try {
		const chain = getChainConfig(ACTIVE_NETWORK);
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
				chain: chain.name,
				chainId: chain.id,
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
