import { parseUnits, formatUnits } from "viem";

export function parseAmount(amount: string, decimals: number): bigint {
	return parseUnits(amount, decimals);
}

export function formatAmount(amount: bigint, decimals: number): string {
	return formatUnits(amount, decimals);
}
