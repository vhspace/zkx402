# HackMoney notes (zkx402)

Quick cheat-sheet for a hackathon build using this repo + the MCP servers we’ve wired up.

## MCP servers configured in this repo

Configured in `.cursor/mcp.json`:

- **Context7 (`Context7`)**: library/package docs (best for SDK APIs, not product marketing sites)
- **Web search (`tavily-remote-mcp`)**: find canonical docs/pages quickly
- **Browser automation (`playwright`)**: validate UI flows in a real browser

### Chain + explorer + simulation

- **Blockscout (`blockscout`)**: multi-chain explorer data via MCP  
  Docs: `https://docs.blockscout.com/devs/mcp-server`
- **Etherscan (`etherscan`)**: explorer + MCP tools (early-access bearer token)  
  Docs: `https://docs.etherscan.io/mcp`
- **Alchemy (`alchemy`)**: multichain data APIs via MCP  
  Repo/docs: `https://github.com/alchemyplatform/alchemy-mcp-server`
- **Tenderly (`tenderly`)**: tx simulation / debugging via MCP  
  Community server (env vars): `TENDERLY_ACCOUNT_SLUG`, `TENDERLY_PROJECT_ID`, `TENDERLY_ACCESS_TOKEN`

### Identity / payments / naming

- **Self Protocol (`self-mcp`)**: Self integration helpers + read-only chain operations  
  Repo: `https://github.com/selfxyz/self-mcp`  
  Install (once, in the environment running MCP servers):
  - `pip install git+https://github.com/selfxyz/self-mcp.git`
- **Circle (`circle`)**: Circle “Build with AI” MCP (Wallets, Contracts, CCTP, Bridge Kit, Gateway)  
  Docs: `https://developers.circle.com/ai/mcp`
- **ENS (`ens`)**: dedicated ENS MCP (resolve names, reverse lookup, records, availability, pricing, history)  
  Repo: `https://github.com/JustaName-id/ens-mcp-server`

## Environment variables to set (devcontainer-friendly)

These are referenced by `.cursor/mcp.json` and `.devcontainer/devcontainer.json`:

- **`TAVILY_API_KEY`**: web search MCP
- **`ALCHEMY_API_KEY`**: Alchemy MCP
- **`ETHERSCAN_BEARER_TOKEN`**: Etherscan MCP (early access; bearer token)
- **`TENDERLY_ACCOUNT_SLUG` / `TENDERLY_PROJECT_ID` / `TENDERLY_ACCESS_TOKEN`**: Tenderly MCP
- **`ENS_PROVIDER_URL`**: optional RPC URL(s) for ENS MCP (comma-separated list supported). If unset, it may fall back to public RPCs per the ENS MCP README.

## Network focus (quick mapping)

- **Base Sepolia**
  - Prefer: **Blockscout** + **Alchemy**
  - Use Tenderly when you need trace/sim
- **Ethereum mainnet**
  - Prefer: **Etherscan** + **Alchemy**
  - ENS lookups: **ENS MCP** (or Etherscan’s ENS tools if your bearer token works)
- **Self Protocol networks**
  - Use **Self MCP** (its tools mention Celo mainnet/testnet support)

## Docs that are usually *not* in Context7

Context7 is strongest for **versioned library docs** (e.g., npm/pip packages). For these, prefer canonical docs:

- Circle product docs: `https://developers.circle.com/`
- Yellow / ERC-7824:
  - Yellow quickstart: `https://docs.yellow.org/docs/build/quick-start/`
  - Smart clearing protocol: `https://docs.yellow.org/yellow-network/architecture-and-design/smart-clearing-protocol`
  - ERC-7824 hub: `https://erc7824.org/`
- ENS protocol docs: `https://docs.ens.domains/` (Context7 may still help for ENS *libraries*, e.g. `@ensdomains/ensjs`)

## Uniswap Foundation “About” (for writeups / slides)

Canonical page: `https://uniswapfoundation.org/about`

Key copy points from the page:
- Uniswap is described as “the world’s largest decentralized trading protocol” (25M+ wallets, $2.55T+ lifetime volume).
- The Uniswap Foundation (founded 2022) focuses on growth/sustainability/decentralization of the community.
- Foundation expansion in 2024 includes builder programs for **Unichain** and **Uniswap v4**.

## Optional: Uniswap MCP servers (community)

Not official Uniswap Foundation tooling, but useful for hackathon prototyping:

- Uniswap pools data MCP (community): `https://mcpservers.org/servers/kukapay/uniswap-pools-mcp`
- Uniswap trader MCP (community): `https://github.com/kukapay/uniswap-trader-mcp`

## Sui track notes (prizes + resources)

About (from the prompt):
- Sui positions itself as “high performance, strong security, and deep composability” aimed at DeFi at real-world scale.
- They’re looking for teams to continue beyond the hackathon via a longer-term relationship (including their Moonshot Program).

Prizes (from the prompt):
- **Best Overall Project**: $3,000
- **Notable Projects**: $7,000 total (up to 7 teams × $1,000)

Qualification checklist (copy/paste friendly):
- Built on Sui and meaningfully uses Sui-specific capabilities
- Working prototype / functional demo
- Clear explanation of the problem + why Sui is well-suited
- Strong execution (Best Overall: at least 2 areas; Notable: at least 1 area)
- Potential for continued development beyond the hackathon

Resources:
- Getting started: `https://docs.sui.io/guides/developer/getting-started`
- Intro to PTBs (TypeScript SDK): `https://docs.sui.io/guides/developer/sui-101/building-ptb`
- DeepBook docs: `https://docs.sui.io/standards/deepbook`
- DeepBookV3 repo: `https://github.com/MystenLabs/deepbookv3`
- Sui DeFi overview: `https://www.sui.io/defi`

MCP angle:
- There’s no clearly “official Mysten Labs” MCP server, but there are community Sui MCP servers (example: `https://github.com/deanpluse/sui-mcp`) that provide faucet/balance/transfer tools.
- For “how do I build X on Sui?” questions, the canonical source is Sui Docs (above); Context7 is most useful when you’re integrating a specific SDK package API surface.

## LI.FI notes (bridge + DEX aggregation)

About (matches the “Advanced Bridge & DEX Aggregation” framing):
- LI.FI positions itself as a **multi-chain routing layer** for swaps, transfers, and payments, exposed through **API / SDK / Widget**.  
  Canonical overview: [Why LI.FI & What is LI.FI](https://docs.li.fi/overview/what-is-li.fi)

Developer entry points:
- SDK overview: [LI.FI SDK Overview](https://docs.li.fi/sdk/overview)
- API docs (base URL `https://li.quest/v1`): [LI.FI API Overview](https://apidocs.li.fi/)
- SDK package (good Context7 candidate): [`@lifi/sdk`](https://www.npmjs.com/package/@lifi/sdk)

MCP angle:
- LI.FI appears to have an MCP server implementation on GitHub: `https://github.com/lifinance/lifi-mcp`
  - Treat any “execute swaps/bridges from an AI tool” flow as **high risk**: use test wallets / small funds only.

