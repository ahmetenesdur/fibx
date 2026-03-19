import { parseUnits, formatUnits } from "viem";

export function parseAmount(amount: string, decimals: number): bigint {
	const cleanAmount = amount.replace(/[$,]/g, "");
	return parseUnits(cleanAmount, decimals);
}

export function formatAmount(amount: bigint, decimals: number): string {
	return formatUnits(amount, decimals);
}
