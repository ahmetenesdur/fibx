import { z } from "zod";
import { ErrorCode, FibxError } from "./errors.js";

export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address");

export const amountSchema = z.string().refine(
	(v) => {
		const clean = v.replace(/[$,]/g, "");
		return !isNaN(Number(clean)) && Number(clean) > 0;
	},
	{
		message: "Amount must be a positive number",
	}
);

export function validateAddress(addr: string): string {
	const result = addressSchema.safeParse(addr);
	if (!result.success) {
		throw new FibxError(ErrorCode.INVALID_ADDRESS, result.error.message);
	}
	return result.data;
}

export function validateAmount(amount: string): string {
	const result = amountSchema.safeParse(amount);
	if (!result.success) {
		throw new FibxError(ErrorCode.INVALID_AMOUNT, result.error.message);
	}
	return result.data;
}
