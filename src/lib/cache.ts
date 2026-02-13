import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { paths, TOKEN_CACHE_TTL_MS } from "./config.js";

interface CacheEntry<T> {
	_cachedAt: number;
	data: T;
}

function getCachePath(key: string): string {
	return join(paths.cache, `${key}.json`);
}

export function readCache<T>(key: string, ttlMs: number = TOKEN_CACHE_TTL_MS): T | null {
	try {
		const raw = readFileSync(getCachePath(key), "utf-8");
		const entry: CacheEntry<T> = JSON.parse(raw);
		return Date.now() - entry._cachedAt > ttlMs ? null : entry.data;
	} catch {
		return null;
	}
}

export function writeCache(key: string, data: unknown): void {
	const filePath = getCachePath(key);
	mkdirSync(dirname(filePath), { recursive: true });

	const entry: CacheEntry<unknown> = { _cachedAt: Date.now(), data };
	writeFileSync(filePath, JSON.stringify(entry, null, 2), "utf-8");
}
