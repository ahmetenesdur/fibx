import type { Address } from "viem";
import { loadSession } from "../auth/session.js";
import { getChainConfig, SUPPORTED_CHAINS, type ChainConfig } from "../chain/constants.js";
import { getPublicClient } from "../chain/client.js";
import { getTokens, type Token } from "../fibrous/tokens.js";
import { getBalances } from "../fibrous/balances.js";
import { formatAmount } from "../../lib/parseAmount.js";
import { AaveService } from "../defi/aave.js";

interface Asset {
	symbol: string;
	balance: string;
	price: number;
	usdValue: number;
}

interface ChainPortfolio {
	chain: string;
	assets: Asset[];
	totalUsd: number;
}

interface DeFiPosition {
	protocol: string;
	chain: string;
	collateralUsd: number;
	debtUsd: number;
	healthFactor: string;
	netUsd: number;
}

export interface Portfolio {
	wallet: string;
	chains: ChainPortfolio[];
	defi: DeFiPosition[];
	totalUsd: number;
}

function getNativePrice(tokens: Record<string, Token>, chainConfig: ChainConfig): number {
	const wrapped = Object.values(tokens).find(
		(t) => t.address.toLowerCase() === chainConfig.wrappedNativeAddress.toLowerCase()
	);
	return wrapped?.price ? parseFloat(wrapped.price) : 0;
}

async function fetchChainPortfolio(
	chainConfig: ChainConfig,
	wallet: Address
): Promise<ChainPortfolio> {
	const client = getPublicClient(chainConfig);
	const tokensMap = await getTokens(chainConfig);
	const tokenList = Object.values(tokensMap);

	const [nativeBalance, tokenBalances] = await Promise.all([
		client.getBalance({ address: wallet }),
		getBalances(tokenList, wallet, chainConfig),
	]);

	const assets: Asset[] = [];

	const nativeBalanceStr = formatAmount(nativeBalance, 18);
	const nativeBalanceNum = parseFloat(nativeBalanceStr);
	if (nativeBalanceNum > 0) {
		const nativePrice = getNativePrice(tokensMap, chainConfig);
		assets.push({
			symbol: chainConfig.nativeSymbol,
			balance: nativeBalanceStr,
			price: nativePrice,
			usdValue: nativeBalanceNum * nativePrice,
		});
	}

	for (const item of tokenBalances) {
		const balanceNum = parseFloat(item.balance);
		if (balanceNum > 0) {
			const addr = item.token.address.toLowerCase();
			if (addr === chainConfig.wrappedNativeAddress.toLowerCase()) continue;
			if (addr === chainConfig.nativeTokenAddress.toLowerCase()) continue;

			const token = tokenList.find((t) => t.address.toLowerCase() === addr);
			const symbol = token?.symbol ?? addr.slice(0, 10);
			const price = token?.price ? parseFloat(token.price) : 0;

			assets.push({
				symbol,
				balance: item.balance,
				price,
				usdValue: balanceNum * price,
			});
		}
	}

	assets.sort((a, b) => b.usdValue - a.usdValue);

	return {
		chain: chainConfig.name,
		assets,
		totalUsd: assets.reduce((sum, a) => sum + a.usdValue, 0),
	};
}

async function fetchAavePosition(wallet: Address): Promise<DeFiPosition | null> {
	try {
		const chainConfig = getChainConfig("base");
		const aave = new AaveService(chainConfig);
		const data = await aave.getUserAccountData(wallet);

		const collateral = parseFloat(data.totalCollateralUSD);
		const debt = parseFloat(data.totalDebtUSD);

		if (collateral === 0 && debt === 0) return null;

		return {
			protocol: "Aave V3",
			chain: "base",
			collateralUsd: collateral,
			debtUsd: debt,
			healthFactor: data.healthFactor,
			netUsd: collateral - debt,
		};
	} catch {
		return null;
	}
}

export async function getPortfolio(): Promise<Portfolio> {
	const session = loadSession();
	if (!session) {
		throw new Error("No active session. Run 'fibx auth login <email>' first.");
	}

	const wallet = session.walletAddress as Address;
	const chainNames = Object.keys(SUPPORTED_CHAINS);

	const results = await Promise.allSettled([
		...chainNames.map((name) => fetchChainPortfolio(getChainConfig(name), wallet)),
		fetchAavePosition(wallet),
	]);

	const chains: ChainPortfolio[] = [];
	const defi: DeFiPosition[] = [];

	for (let i = 0; i < chainNames.length; i++) {
		const result = results[i];
		if (result.status === "fulfilled" && result.value) {
			const portfolio = result.value as ChainPortfolio;
			if (portfolio.assets.length > 0) {
				chains.push(portfolio);
			}
		}
	}

	const aaveResult = results[chainNames.length];
	if (aaveResult.status === "fulfilled" && aaveResult.value) {
		defi.push(aaveResult.value as DeFiPosition);
	}

	chains.sort((a, b) => b.totalUsd - a.totalUsd);

	const chainTotal = chains.reduce((sum, c) => sum + c.totalUsd, 0);
	const defiTotal = defi.reduce((sum, d) => sum + d.netUsd, 0);

	return {
		wallet,
		chains,
		defi,
		totalUsd: chainTotal + defiTotal,
	};
}
