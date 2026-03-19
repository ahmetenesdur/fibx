import type { Address } from "viem";

// https://docs.aave.com/developers/deployed-contracts/v3-mainnet/base
export const AAVE_V3_POOL_ADDRESSES_PROVIDER =
	"0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D" as Address;

export const AAVE_V3_POOL_DATA_PROVIDER = "0x0F43731EB8d45A581f4a36DD74F5f358bc90C73A" as Address;

export const HEALTH_FACTOR_WARNING_THRESHOLD = 1.5;
export const HEALTH_FACTOR_CRITICAL_THRESHOLD = 1.1;

export enum InterestRateMode {
	None = 0,
	Stable = 1,
	Variable = 2,
}
