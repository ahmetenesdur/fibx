import type { ChainConfig } from "../chain/constants.js";
import { FIBROUS_GRAPH_URL } from "../../lib/config.js";
import { readCache, writeCache } from "../../lib/cache.js";
import { ErrorCode, FibxError } from "../../lib/errors.js";
import { withRetry } from "../../lib/retry.js";
import { fetchWithTimeout } from "../../lib/fetch.js";

export interface Token {
	name: string;
	address: string;
	decimals: number;
	symbol: string;
	price?: string;
}

export type TokenMap = Record<string, Token>;

// ── O(1) Lookup Indexes (per chain) ──
const symbolIndexCache = new Map<string, Map<string, Token>>();
const addressIndexCache = new Map<string, Map<string, Token>>();

function buildIndexes(chain: string, tokens: TokenMap): void {
	const tokenList = Object.values(tokens);
	const symbolMap = new Map<string, Token>();
	const addressMap = new Map<string, Token>();

	for (const t of tokenList) {
		symbolMap.set(t.symbol.toLowerCase(), t);
		addressMap.set(t.address.toLowerCase(), t);
	}

	symbolIndexCache.set(chain, symbolMap);
	addressIndexCache.set(chain, addressMap);
}

export async function getTokens(chain: ChainConfig): Promise<TokenMap> {
	const CACHE_KEY = `tokens-${chain.fibrousNetwork}`;
	const cached = readCache<TokenMap>(CACHE_KEY);
	if (cached) {
		// Build indexes from cache if not already built
		if (!symbolIndexCache.has(chain.fibrousNetwork)) {
			buildIndexes(chain.fibrousNetwork, cached);
		}
		return cached;
	}

	try {
		const data = await withRetry(
			async () => {
				const res = await fetchWithTimeout(
					`${FIBROUS_GRAPH_URL}/${chain.fibrousNetwork}/tokens`
				);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return (await res.json()) as TokenMap;
			},
			{ maxRetries: 2, baseDelayMs: 500 }
		);

		writeCache(CACHE_KEY, data);
		buildIndexes(chain.fibrousNetwork, data);
		return data;
	} catch (error) {
		throw new FibxError(
			ErrorCode.FIBROUS_ERROR,
			`Failed to fetch tokens: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

export async function resolveToken(symbolOrAddress: string, chain: ChainConfig): Promise<Token> {
	// Ensure indexes are populated (no-ops if cached)
	await getTokens(chain);
	const input = symbolOrAddress.toLowerCase();

	// O(1) address lookup
	if (input.startsWith("0x")) {
		const addressIndex = addressIndexCache.get(chain.fibrousNetwork);
		const token = addressIndex?.get(input);
		if (token) return token;
	}

	// O(1) symbol lookup
	const symbolIndex = symbolIndexCache.get(chain.fibrousNetwork);
	const token = symbolIndex?.get(input);

	if (!token) {
		throw new FibxError(
			ErrorCode.TOKEN_NOT_SUPPORTED,
			`Token "${symbolOrAddress}" not found on ${chain.name}`
		);
	}

	return token;
}
