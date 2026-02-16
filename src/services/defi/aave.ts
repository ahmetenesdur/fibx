import {
	createPublicClient,
	http,
	parseUnits,
	formatUnits,
	maxUint256,
	type Address,
	type Hash,
	type Account,
	type PublicClient,
	type WalletClient,
	erc20Abi,
} from "viem";
import { type ChainConfig } from "../chain/constants.js";
import {
	POOL_ADDRESSES_PROVIDER_ABI,
	POOL_ABI,
	POOL_DATA_PROVIDER_ABI,
	WETH_ABI,
} from "./abi/aave.js";
import {
	AAVE_V3_POOL_ADDRESSES_PROVIDER,
	AAVE_V3_POOL_DATA_PROVIDER,
	InterestRateMode,
} from "./constants.js";
import { NonceManager } from "../chain/nonceManager.js";
import { ErrorCode, FibxError } from "../../lib/errors.js";

export interface UserAccountData {
	totalCollateralUSD: string;
	totalDebtUSD: string;
	availableBorrowsUSD: string;
	currentLiquidationThreshold: string;
	ltv: string;
	healthFactor: string;
}

type DataProviderReserveData = readonly [
	bigint, // currentATokenBalance
	bigint, // currentStableDebt
	bigint, // currentVariableDebt
	bigint, // principalStableDebt
	bigint, // scaledVariableDebt
	bigint, // stableBorrowRate
	bigint, // liquidityRate
	number, // stableRateLastUpdated
	boolean, // usageAsCollateralEnabled
];

export class AaveService {
	private publicClient: PublicClient;
	private walletClient?: WalletClient;
	private account?: Account;
	private userAddress?: Address;

	private chainConfig: ChainConfig;

	constructor(chainConfig: ChainConfig, walletClient?: WalletClient) {
		this.chainConfig = chainConfig;
		this.publicClient = createPublicClient({
			chain: chainConfig.viemChain,
			transport: http(chainConfig.rpcUrl),
		}) as PublicClient;

		if (walletClient) {
			this.setWalletClient(walletClient);
		}
	}

	public getAccountAddress(): Address | undefined {
		return this.userAddress;
	}

	public setAccountAddress(address: Address) {
		this.userAddress = address;
	}

	public setWalletClient(walletClient: WalletClient) {
		this.walletClient = walletClient;
		if (walletClient.account) {
			this.account = walletClient.account;
			this.userAddress = walletClient.account.address;
			NonceManager.getInstance().init(this.userAddress, this.publicClient);
		}
	}

	private async getPoolAddress(): Promise<Address> {
		return (await this.publicClient.readContract({
			address: AAVE_V3_POOL_ADDRESSES_PROVIDER,
			abi: POOL_ADDRESSES_PROVIDER_ABI,
			functionName: "getPool",
		})) as Address;
	}

	public async getUserAccountData(userAddress: Address): Promise<UserAccountData> {
		const poolAddress = await this.getPoolAddress();
		const data = await this.publicClient.readContract({
			address: poolAddress,
			abi: POOL_ABI,
			functionName: "getUserAccountData",
			args: [userAddress],
		});

		// Aave V3 getUserAccountData returns values in Base Currency (USD, 8 decimals)
		return {
			totalCollateralUSD: formatUnits(data[0], 8),
			totalDebtUSD: formatUnits(data[1], 8),
			availableBorrowsUSD: formatUnits(data[2], 8),
			currentLiquidationThreshold: formatUnits(data[3], 4),
			ltv: formatUnits(data[4], 4),
			healthFactor: formatUnits(data[5], 18),
		};
	}

	public async supply(tokenAddress: Address, amountStr: string): Promise<Hash> {
		this.ensureWalletConnection();

		const poolAddress = await this.getPoolAddress();
		const decimals = await this.getTokenDecimals(tokenAddress);
		const amount = parseUnits(amountStr, decimals);

		const allowance = await this.publicClient.readContract({
			address: tokenAddress,
			abi: erc20Abi,
			functionName: "allowance",
			args: [this.account!.address, poolAddress],
		});

		if (allowance < amount) {
			const nonceApprove = await NonceManager.getInstance().getNextNonce();
			const txApprove = await this.walletClient!.writeContract({
				address: tokenAddress,
				abi: erc20Abi,
				functionName: "approve",
				args: [poolAddress, amount],
				chain: this.chainConfig.viemChain,
				account: this.account!,
				nonce: nonceApprove,
			});
			await this.publicClient.waitForTransactionReceipt({ hash: txApprove });
			await this.waitForAllowance(tokenAddress, poolAddress, amount);
		}

		const { request: supplyRequest } = await this.publicClient.simulateContract({
			address: poolAddress,
			abi: POOL_ABI,
			functionName: "supply",
			args: [tokenAddress, amount, this.account!.address, 0],
			account: this.account!,
			chain: this.chainConfig.viemChain,
		});

		const nonceSupply = await NonceManager.getInstance().getNextNonce();
		const txSupply = await this.walletClient!.writeContract({
			...supplyRequest,
			nonce: nonceSupply,
		});

		await this.publicClient.waitForTransactionReceipt({ hash: txSupply });
		return txSupply;
	}

	public async wrapETH(amountStr: string): Promise<Hash> {
		this.ensureWalletConnection();

		const amount = parseUnits(amountStr, 18);

		const { request } = await this.publicClient.simulateContract({
			address: this.chainConfig.wrappedNativeAddress as Address,
			abi: WETH_ABI,
			functionName: "deposit",
			args: [],
			value: amount,
			account: this.account!,
			chain: this.chainConfig.viemChain,
		});

		const nonce = await NonceManager.getInstance().getNextNonce();

		const txWrap = await this.walletClient!.writeContract({
			...request,
			nonce,
		});

		await this.publicClient.waitForTransactionReceipt({ hash: txWrap });
		return txWrap;
	}

	public async unwrapWETH(amountStr: string): Promise<Hash> {
		this.ensureWalletConnection();

		const amount = parseUnits(amountStr, 18);

		const { request } = await this.publicClient.simulateContract({
			address: this.chainConfig.wrappedNativeAddress as Address,
			abi: WETH_ABI,
			functionName: "withdraw",
			args: [amount],
			account: this.account!,
			chain: this.chainConfig.viemChain,
		});

		const nonce = await NonceManager.getInstance().getNextNonce();

		const txUnwrap = await this.walletClient!.writeContract({
			...request,
			nonce,
		});

		await this.publicClient.waitForTransactionReceipt({ hash: txUnwrap });
		return txUnwrap;
	}

	public async withdraw(tokenAddress: Address, amountStr: string): Promise<Hash> {
		this.ensureWalletConnection();

		const poolAddress = await this.getPoolAddress();
		const userAddress = this.account!.address;
		let amount: bigint;

		if (amountStr.toLowerCase() === "max" || amountStr === "-1") {
			amount = maxUint256;
		} else {
			const decimals = await this.getTokenDecimals(tokenAddress);
			amount = parseUnits(amountStr, decimals);
		}

		let request;
		try {
			const result = await this.publicClient.simulateContract({
				address: poolAddress,
				abi: POOL_ABI,
				functionName: "withdraw",
				args: [tokenAddress, amount, userAddress],
				account: userAddress,
				chain: this.chainConfig.viemChain,
			});
			request = result.request;
		} catch (error: unknown) {
			await this.handleLiquidationError(error, userAddress);
			throw error; // detailed error thrown by handleLiquidationError, but needed for TS control flow
		}

		const nonce = await NonceManager.getInstance().getNextNonce();

		const txWithdraw = await this.walletClient!.writeContract({
			...request,
			nonce,
		});

		await this.publicClient.waitForTransactionReceipt({ hash: txWithdraw });
		return txWithdraw;
	}

	public async borrow(tokenAddress: Address, amountStr: string): Promise<Hash> {
		this.ensureWalletConnection();

		const poolAddress = await this.getPoolAddress();
		const decimals = await this.getTokenDecimals(tokenAddress);
		const amount = parseUnits(amountStr, decimals);

		let request;
		try {
			const result = await this.publicClient.simulateContract({
				address: poolAddress,
				abi: POOL_ABI,
				functionName: "borrow",
				args: [
					tokenAddress,
					amount,
					BigInt(InterestRateMode.Variable),
					0,
					this.account!.address,
				],
				chain: this.chainConfig.viemChain,
				account: this.account!,
			});
			request = result.request;
		} catch (error: unknown) {
			const err = error as Error & { cause?: { message?: string } };
			if (
				err.message?.includes("HealthFactorLowerThanLiquidationThreshold") ||
				err.cause?.message?.includes("0x6679996d")
			) {
				throw new FibxError(
					ErrorCode.WALLET_ERROR,
					"Cannot borrow: This amount would lower your Health Factor below 1.0 (Liquidation Threshold). Try borrowing a smaller amount or adding more collateral first."
				);
			}
			throw error;
		}

		const nonce = await NonceManager.getInstance().getNextNonce();

		const txBorrow = await this.walletClient!.writeContract({
			...request,
			nonce,
		});

		await this.publicClient.waitForTransactionReceipt({ hash: txBorrow });
		return txBorrow;
	}

	public async repay(tokenAddress: Address, amountStr: string): Promise<Hash> {
		this.ensureWalletConnection();

		const poolAddress = await this.getPoolAddress();
		let amount: bigint;

		if (amountStr.toLowerCase() === "max" || amountStr === "-1") {
			amount = maxUint256;
		} else {
			const decimals = await this.getTokenDecimals(tokenAddress);
			amount = parseUnits(amountStr, decimals);
		}

		// Check Allowance & Approve if necessary
		const allowance = await this.publicClient.readContract({
			address: tokenAddress,
			abi: erc20Abi,
			functionName: "allowance",
			args: [this.account!.address, poolAddress],
		});

		if (allowance < amount) {
			const nonceApprove = await NonceManager.getInstance().getNextNonce();
			const txApprove = await this.walletClient!.writeContract({
				address: tokenAddress,
				abi: erc20Abi,
				functionName: "approve",
				args: [poolAddress, amount],
				chain: this.chainConfig.viemChain,
				account: this.account!,
				nonce: nonceApprove,
			});
			await this.publicClient.waitForTransactionReceipt({ hash: txApprove });
			await this.waitForAllowance(tokenAddress, poolAddress, amount);
		}

		try {
			const { request: repayRequest } = await this.publicClient.simulateContract({
				address: poolAddress,
				abi: POOL_ABI,
				functionName: "repay",
				args: [
					tokenAddress,
					amount,
					BigInt(InterestRateMode.Variable),
					this.account!.address,
				],
				account: this.account!,
				chain: this.chainConfig.viemChain,
			});

			const nonceRepay = await NonceManager.getInstance().getNextNonce();

			const txRepay = await this.walletClient!.writeContract({
				...repayRequest,
				nonce: nonceRepay,
			});

			await this.publicClient.waitForTransactionReceipt({ hash: txRepay });
			return txRepay;
		} catch (error: unknown) {
			const err = error as Error & { cause?: { message?: string } };
			// Check for NoDebtOfSelectedType (0xf0788fb2)
			if (
				err.message?.includes("NoDebtOfSelectedType") ||
				err.cause?.message?.includes("0xf0788fb2")
			) {
				// This is actually a success state for "repay max" - we are already debt free
				return "0x0" as Hash; // Return dummy hash to indicate success without tx
			}
			throw error;
		}
	}

	private ensureWalletConnection() {
		if (!this.walletClient || !this.account) {
			throw new FibxError(
				ErrorCode.WALLET_ERROR,
				"Wallet not connected. Please login or provide a PRIVATE_KEY."
			);
		}
	}

	private async getTokenDecimals(tokenAddress: Address): Promise<number> {
		return await this.publicClient.readContract({
			address: tokenAddress,
			abi: erc20Abi,
			functionName: "decimals",
		});
	}

	private async waitForAllowance(
		tokenAddress: Address,
		spender: Address,
		targetAmount: bigint
	): Promise<void> {
		let retries = 0;
		const maxRetries = 15; // 30 seconds
		while (retries < maxRetries) {
			const allowance = await this.publicClient.readContract({
				address: tokenAddress,
				abi: erc20Abi,
				functionName: "allowance",
				args: [this.account!.address, spender],
			});
			if (allowance >= targetAmount) {
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 2000));
			retries++;
		}
	}

	private async getDebts(
		dataProviderAddress: Address,
		reserves: readonly Address[]
	): Promise<string[]> {
		const debtDetails: string[] = [];

		// 1. Batch fetch all reserve data using multicall
		const reserveDataCalls = reserves.map((asset) => ({
			address: dataProviderAddress,
			abi: POOL_DATA_PROVIDER_ABI,
			functionName: "getUserReserveData",
			args: [asset, this.account!.address],
		}));

		const results = await this.publicClient.multicall({
			contracts: reserveDataCalls,
			allowFailure: true, // Continue even if some fail
		});

		// 2. Identify assets with debt
		const assetsWithDebt: Address[] = [];
		const debts: bigint[] = [];

		results.forEach((result, index) => {
			if (result.status === "success" && result.result) {
				const data = result.result as DataProviderReserveData;
				const stableDebt = data[1];
				const variableDebt = data[2];

				if (stableDebt > 0n || variableDebt > 0n) {
					assetsWithDebt.push(reserves[index]);
					debts.push(stableDebt + variableDebt);
				}
			}
		});

		// 3. Fetch symbol/decimals for assets with debt using multicall
		if (assetsWithDebt.length > 0) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const detailCalls: any[] = [];
			assetsWithDebt.forEach((asset) => {
				detailCalls.push({
					address: asset,
					abi: erc20Abi,
					functionName: "symbol",
				});
				detailCalls.push({
					address: asset,
					abi: erc20Abi,
					functionName: "decimals",
				});
			});

			try {
				const detailResults = await this.publicClient.multicall({
					contracts: detailCalls,
					allowFailure: false, // If these fail, we can't display details properly
				});

				for (let i = 0; i < assetsWithDebt.length; i++) {
					const symbol = detailResults[i * 2] as string;
					const decimals = detailResults[i * 2 + 1] as number;
					const debt = debts[i];
					debtDetails.push(`${symbol}: $${formatUnits(debt, decimals)}`);
				}
			} catch (e) {
				console.warn("Failed to fetch debt token details via multicall:", e);
				// Fallback: just list addresses and raw amounts if metadata fails
				assetsWithDebt.forEach((asset, i) => {
					debtDetails.push(`${asset}: raw units ${debts[i]}`);
				});
			}
		}

		return debtDetails;
	}

	private async handleLiquidationError(error: unknown, userAddress: Address): Promise<never> {
		const err = error as Error & { cause?: { message?: string } };
		const userData = await this.getUserAccountData(userAddress);
		const totalDebt = parseFloat(userData.totalDebtUSD);

		if (
			err.message?.includes("HealthFactorLowerThanLiquidationThreshold") ||
			err.cause?.message?.includes("0x6679996d")
		) {
			let details = "This amount would lower your Health Factor below 1.0.";

			// Check for cross-asset dust debt
			if (totalDebt > 0) {
				try {
					const poolContract = {
						address: await this.getPoolAddress(),
						abi: POOL_ABI,
					} as const;

					const reserves = await this.publicClient.readContract({
						...poolContract,
						functionName: "getReservesList",
					});

					const debts = await this.getDebts(
						AAVE_V3_POOL_DATA_PROVIDER,
						reserves as unknown as readonly Address[]
					);

					if (debts.length > 0) {
						details = `You have remaining debt in other assets: ${debts.join(
							", "
						)}. You must repay these debts first to withdraw max collateral.`;
					} else if (totalDebt < 0.01) {
						// If scanning returned nothing but we have dust debt, show generic message
						details = `You have tiny "dust" debt ($${totalDebt.toFixed(
							6
						)}) in an asset (scan failed to identify) preventing full withdrawal.`;
					}
				} catch (e) {
					console.error("Error scanning debts:", e);
					// Fallback if scanning fails
					if (totalDebt < 0.01) {
						details = `You have tiny "dust" debt ($${totalDebt.toFixed(
							6
						)}) in an asset preventing full withdrawal.`;
					}
				}
			}

			const totalCollateral = parseFloat(userData.totalCollateralUSD);
			const lt = parseFloat(userData.currentLiquidationThreshold) / 10000;
			if (lt > 0) {
				const requiredCollateral = totalDebt / lt;
				const maxSafeUSD = Math.max(0, totalCollateral - requiredCollateral);
				if (maxSafeUSD < totalCollateral) {
					details += ` You need keep ~$${requiredCollateral.toFixed(2)} collateral to cover your debt. Max safe withdraw is approx $${maxSafeUSD.toFixed(2)}.`;
				}
			}

			throw new FibxError(ErrorCode.WALLET_ERROR, `Cannot withdraw: ${details}`);
		}
		throw error;
	}
}
