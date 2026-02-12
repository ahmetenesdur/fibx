import envPaths from "env-paths";

export const paths = envPaths("fibx");

export const BASE_CHAIN_ID = 8453;
export const BASE_RPC_URL = "https://mainnet.base.org";

export const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const NATIVE_ETH_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
export const WETH_ADDRESS = "0x4200000000000000000000000000000000000006" as const;

export const USDC_DECIMALS = 6;
export const ETH_DECIMALS = 18;

export const FIBROUS_BASE_URL = "https://api.fibrous.finance";
export const FIBROUS_NETWORK = "base";

export const DEFAULT_SLIPPAGE = 0.5;
export const TOKEN_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
