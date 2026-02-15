import type { Address, PublicClient } from "viem";

export class NonceManager {
	private static instance: NonceManager;
	private nonce: number | null = null;
	private address: Address | null = null;
	private publicClient: PublicClient | null = null;
	private mutex: Promise<void> = Promise.resolve();

	private constructor() {}

	public static getInstance(): NonceManager {
		if (!NonceManager.instance) {
			NonceManager.instance = new NonceManager();
		}
		return NonceManager.instance;
	}

	public async init(address: Address, publicClient: PublicClient) {
		// Only re-initialize if address changes or not initialized
		if (this.address !== address || this.nonce === null) {
			this.address = address;
			this.publicClient = publicClient;
			this.nonce = await publicClient.getTransactionCount({ address });
		}
	}

	public async getNextNonce(): Promise<number> {
		if (this.nonce === null) {
			throw new Error("NonceManager not initialized. Call init() first.");
		}

		// Simple mutex to ensure sequential access if needed, though JS is single-threaded
		// this helps if we add async logic inside the critical section later.
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
		this.publicClient = null;
	}
}
