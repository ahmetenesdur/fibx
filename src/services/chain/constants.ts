import type { Abi } from "viem";
import { base } from "viem/chains";
import { baseRouterAbi } from "../fibrous/abi/base.js";

export interface ChainConfig {
	id: number;
	name: string;
	viemChain: typeof base;
	rpcUrl: string;
	nativeTokenAddress: string;
	fibrousNetwork: string;
	routerAbi: Abi;
}

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
	base: {
		id: 8453,
		name: "base",
		viemChain: base,
		rpcUrl: "https://mainnet.base.org",
		nativeTokenAddress: "0x0000000000000000000000000000000000000000",
		fibrousNetwork: "base",
		routerAbi: baseRouterAbi as Abi,
	},
};

export function getChainConfig(network: string): ChainConfig {
	const config = SUPPORTED_CHAINS[network];
	if (!config) {
		throw new Error(
			`Unsupported chain: ${network}. Supported: ${Object.keys(SUPPORTED_CHAINS).join(", ")}`
		);
	}
	return config;
}
