import type { Address, PublicClient } from "viem";
import { ErrorCode, FibxError } from "../../lib/errors.js";

export class NonceManager {
	private static instance: NonceManager;
	private nonce: number | null = null;
	private address: Address | null = null;
	private mutex: Promise<void> = Promise.resolve();

	private constructor() {}

	public static getInstance(): NonceManager {
		if (!NonceManager.instance) {
			NonceManager.instance = new NonceManager();
		}
		return NonceManager.instance;
	}

	public async init(address: Address, publicClient: PublicClient) {
		if (this.address !== address || this.nonce === null) {
			this.address = address;
			this.nonce = await publicClient.getTransactionCount({ address });
		}
	}

	public async getNextNonce(): Promise<number> {
		if (this.nonce === null) {
			throw new FibxError(
				ErrorCode.WALLET_ERROR,
				"NonceManager not initialized. Call init() first."
			);
		}

		let releaseStr: () => void;
		const lock = new Promise<void>((resolve) => {
			releaseStr = resolve;
		});

		const previousMutex = this.mutex;
		this.mutex = this.mutex.then(() => lock);

		await previousMutex;

		try {
			const nextNonce = this.nonce;
			this.nonce++;
			return nextNonce;
		} finally {
			releaseStr!();
		}
	}

	public reset() {
		this.nonce = null;
		this.address = null;
	}
}
