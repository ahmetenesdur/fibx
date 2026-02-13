# fibx

A command-line tool for specialized DeFi operations on **Base**, powered by [Fibrous Finance](https://fibrous.finance) aggregation and [Privy](https://privy.io) Server Wallets.

[![npm version](https://badge.fury.io/js/fibx.svg)](https://badge.fury.io/js/fibx)

## Features

- **Privy Server Wallets**: Uses "Agentic" server-side wallets (ownerless) for seamless, automated signing without user interaction.
- **ETH & Token Transfers**: Send ETH or any ERC-20 token with a simple command.
- **Fibrous Aggregation**: Execute token swaps with optimal routing and auto-slippage protection.
- **Automated Auth Flow**: One-time email OTP login provisions a persistent server wallet linked to your user profile.
- **JSON Output**: All commands support `--json` for easy integration into scripts and pipelines.

## Requirements

- Node.js ≥ 20
- pnpm
- Privy App ID and Secret (from [dashboard.privy.io](https://dashboard.privy.io))

## Quick Start

### 1. Installation

You can use `fibx` without installation via `npx`, or install it globally.

**Option A: No Installation (Recommended for Agents)**

```bash
npx fibx <command>
```

**Option B: Global Install**

```bash
npm install -g fibx
fibx <command>
```

Set your Privy credentials as environment variables:

```bash
export PRIVY_APP_ID="your_app_id"
export PRIVY_APP_SECRET="your_app_secret"
```

### 3. Authenticate & Provision Wallet

This two-step process links your email to a server-side wallet.

**Step 1: Request OTP**

```bash
npx fibx auth login <email>
# Example:
npx fibx auth login user@example.com
```

**Step 2: Verify & Create Session**

```bash
npx fibx auth verify <email> <code>
# Example:
npx fibx auth verify user@example.com 123456
```

_Successfully verifying will create a local session file and provision a Server Wallet if one doesn't exist._

### 4. Check Status

Verify that you are authenticated and the API is healthy:

```bash
npx fibx status
```

## Usage

### Check Balance

View your ETH and USDC balances on Base:

```bash
npx fibx balance
```

### Send Tokens

Transfer ETH or ERC-20 tokens to another address.

**Send ETH (Default):**

```bash
npx fibx send 0.001 0xRecipientAddress
```

**Send ERC-20 (e.g., USDC):**

```bash
npx fibx send 10 0xRecipientAddress USDC
```

### Swap Tokens

Swap tokens using Fibrous Finance's aggregator.

```bash
npx fibx trade <amount> <from_token> <to_token>
```

**Examples:**

```bash
# Swap 0.0001 ETH to USDC
npx fibx trade 0.0001 ETH USDC

# Swap 20 USDC to DAI
npx fibx trade 20 USDC DAI
```

**Options:**

- `--slippage <number>`: Set slippage tolerance (default: 0.5%)
- `--json`: Output result as JSON

### View Wallet Address

Print your connected server wallet address:

```bash
npx fibx address
```

## Agent Skills

Looking to use `fibx` with an AI Agent? Check out the [fibx-agentic-wallet-skills](./fibx-agentic-wallet-skills/README.md) package.

## Development

1. Clone the repo
2. `pnpm install`
3. `cp .env.example .env` (add secrets)
4. Run commands with `pnpm dev <command>`

# Architecture

This CLI uses a **Server Wallet** architecture:

1.  **Privy**: Manages the embedded wallets. We use "Ownerless" wallets (Agents) that are controlled via the Privy App Secret, allowing the CLI to sign transactions programmatically without requiring a user-side browser or JWT.
2.  **Viem**: Handles all blockchain interactions (RPC calls, transaction signing) using a custom Privy-backed account.
3.  **Fibrous**: Provides the routing and calldata for optimal token swaps on Base.

## Project Structure

```
src/
├── cli.ts               # Entry point & Command definitions
├── commands/            # Command implementation logic
│   ├── auth-login.ts    # Step 1: Request OTP
│   ├── auth-verify.ts   # Step 2: Verify & Provision Wallet
│   ├── trade.ts         # Swap logic via Fibrous
│   ├── send.ts          # ETH/ERC20 transfer logic
│   └── ...
├── chain/               # Blockchain layer
│   └── viem.ts          # Viem client & Custom Privy Account
├── wallet/              # Wallet management
│   ├── privy.ts         # Privy SDK integration (Server Wallets)
│   └── session.ts       # Local session management
├── fibrous/             # Fibrous API integration
└── utils/               # Config, validation, and helpers
```

## License

MIT
