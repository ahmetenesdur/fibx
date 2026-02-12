# fibx

A command-line tool for EVM token operations on **Base**, powered by [Fibrous Finance](https://fibrous.finance) and [Privy](https://privy.io) server-side wallets.

## Features

- **Privy email OTP authentication** with P-256 authorization keys and server-side wallet creation
- **ETH & USDC balance** queries via Base RPC
- **USDC transfers** with encoded ERC-20 transactions
- **Token swaps** through the Fibrous Finance aggregator (best-route, auto-approval)
- **JSON output mode** for scripting and automation (`--json`)

## Requirements

- Node.js ≥ 18
- pnpm
- Privy account ([dashboard.privy.io](https://dashboard.privy.io)) with App ID and App Secret

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env   # fill in PRIVY_APP_ID and PRIVY_APP_SECRET

# 3. Authenticate — sends a one-time code to your email
pnpm dev auth login <email>

# 4. Verify — creates a wallet and outputs the authorization private key
pnpm dev auth verify <email> <code>

# 5. Save the printed authorizationPrivateKey as PRIVY_AUTHORIZATION_KEY in .env

# 6. You're ready!
pnpm dev balance
```

## Environment Variables

| Variable                  | Description                                                  |
| ------------------------- | ------------------------------------------------------------ |
| `PRIVY_APP_ID`            | Privy application ID                                         |
| `PRIVY_APP_SECRET`        | Privy application secret                                     |
| `PRIVY_AUTHORIZATION_KEY` | P-256 private key for wallet signing (generated during auth) |

## Commands

| Command                           | Description                     |
| --------------------------------- | ------------------------------- |
| `fibx auth login <email>`         | Send OTP to email               |
| `fibx auth verify <email> <code>` | Verify OTP, create wallet       |
| `fibx status`                     | Check auth & Fibrous API health |
| `fibx address`                    | Show wallet address             |
| `fibx balance`                    | Show ETH and USDC balances      |
| `fibx send <amount> <recipient>`  | Send USDC to a 0x address       |
| `fibx trade <amount> <from> <to>` | Swap tokens via Fibrous         |

### Global Options

| Flag                     | Description                                   |
| ------------------------ | --------------------------------------------- |
| `--json`                 | Output as JSON (useful for scripting)         |
| `-s, --slippage <value>` | Slippage tolerance (trade only, default: 0.5) |

## Authentication Flow

```
1.  fibx auth login user@example.com
    → Sends a 6-digit OTP to the provided email via Privy

2.  fibx auth verify user@example.com 123456
    → Verifies the OTP
    → Generates a P-256 authorization key pair
    → Creates a server-side Privy wallet owned by the public key
    → Prints the authorization private key (save it — it won't be shown again)

3.  Set PRIVY_AUTHORIZATION_KEY=<key> in your .env file
    → Required for signing transactions (send, trade)
```

## Project Structure

```
src/
├── cli.ts               Entry point & Commander setup
├── commands/             CLI command handlers
│   ├── auth-login.ts     Email OTP initiation
│   ├── auth-verify.ts    OTP verification & wallet creation
│   ├── address.ts        Display wallet address
│   ├── balance.ts        ETH & USDC balances
│   ├── send.ts           USDC transfers
│   ├── status.ts         Auth & API health check
│   └── trade.ts          Token swaps via Fibrous
├── chain/                On-chain interaction layer
│   ├── viem.ts           Public & wallet client setup
│   └── erc20.ts          ERC-20 ABI helpers
├── wallet/               Privy wallet management
│   ├── privy.ts          Privy client & wallet creation
│   ├── session.ts        Local session persistence
│   └── policy.ts         Spending policy (stub)
├── fibrous/              Fibrous Finance API
│   ├── health.ts         Health check
│   ├── route.ts          Route & calldata fetching
│   └── tokens.ts         Token resolution & caching
├── format/
│   └── output.ts         Chalk/Ora formatting & JSON mode
└── utils/
    ├── config.ts          Constants & paths
    ├── errors.ts          Error codes & FibxError class
    ├── validation.ts      Zod-based input validation
    ├── parseAmount.ts     Amount parsing & formatting
    └── cache.ts           File-based TTL cache
```

## Scripts

| Script              | Description             |
| ------------------- | ----------------------- |
| `pnpm dev`          | Run with tsx (dev mode) |
| `pnpm build`        | Compile TypeScript      |
| `pnpm start`        | Run compiled output     |
| `pnpm typecheck`    | Type-check without emit |
| `pnpm lint`         | Run ESLint              |
| `pnpm lint:fix`     | Auto-fix lint issues    |
| `pnpm format`       | Format with Prettier    |
| `pnpm format:check` | Check formatting        |

## License

MIT
