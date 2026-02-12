import { requireSession } from "../wallet/session.js";
import { outputResult, outputError, type OutputOptions } from "../format/output.js";

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
