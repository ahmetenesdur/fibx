import { requireSession } from "../../services/auth/session.js";
import { outputResult, outputError, type OutputOptions } from "../../lib/format.js";

export async function addressCommand(opts: OutputOptions): Promise<void> {
	try {
		const session = requireSession();

		outputResult(
			{
				address: session.walletAddress,
				walletId: session.walletId,
			},
			opts
		);
	} catch (error) {
		outputError(error, opts);
	}
}
