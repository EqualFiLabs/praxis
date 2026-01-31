# praxis

Local-first Position Agent runtime for Equalis. This tool runs on your machine, uses Ollama by default for inference, stores memory locally, and calls your Position NFT TBA through ERC-6551 + ERC-6900.

---

## What this does

- Runs a local agent on your machine (your data stays local by default).
- Reads your local strategy memory and constraints.
- Calls your TBA (Token Bound Account) to execute on-chain actions.
- Respects ERC-6900 installed module selectors (skills are installed on-chain, not inside the runtime).

---

## What you need

1) A computer running macOS, Linux, or Windows (WSL2 recommended).
2) Node.js 20+ installed.
3) Ollama installed for local inference (default).
4) An ERC-6551 TBA for your Position NFT, with ERC-6900 modules installed.

Optional:
- OpenAI-compatible HTTP endpoint if you want external inference.

---

## 1) Install dependencies

From the repo root:

```bash
npm install
```

---

## 2) Install and run Ollama (local LLM)

Follow Ollama setup:
- https://ollama.com

Then pull a model (example):

```bash
ollama pull llama3.2:latest
```

Verify:

```bash
ollama list
```

---

## 3) Create your agent config

Create a folder and config file for your agent. Replace `AGENT_ID` with your ERC-8004 agentId.

```bash
mkdir -p ~/.equalis/agents/AGENT_ID
nano ~/.equalis/agents/AGENT_ID/config.yaml
```

Paste this template and edit values:

```yaml
agent:
  id: "AGENT_ID"
  profile: "default"

auth:
  ownerKeyEnv: "PRAXIS_OWNER_KEY"

inference:
  provider: "ollama"
  fallbackProvider: "external"
  privacy:
    allowExternal: false
    allowSensitiveMemory: false

providers:
  ollama:
    type: "ollama"
    baseUrl: "http://127.0.0.1:11434"
    model: "llama3.2:latest"
    contextWindow: 8192
    maxOutputTokens: 1024
    timeoutMs: 60000
  external:
    type: "external"
    baseUrl: "https://api.openai.com/v1"
    apiKeyEnv: "OPENAI_API_KEY"
    model: "gpt-4o-mini"
    contextWindow: 128000
    maxOutputTokens: 4096
    timeoutMs: 60000
    adapters:
      anthropic:
        baseUrl: "https://api.anthropic.com/v1"
        apiKeyEnv: "ANTHROPIC_API_KEY"
        model: "claude-3-5-sonnet-20240620"
      google:
        baseUrl: "https://generativelanguage.googleapis.com/v1"
        apiKeyEnv: "GOOGLE_API_KEY"
        model: "gemini-1.5-pro"

chain:
  rpcUrl: "https://YOUR_RPC_URL"
  chainId: 1
  tbaAddress: "0xYOUR_TBA_ADDRESS"
  positionNftAddress: "0xYOUR_POSITION_NFT_ADDRESS"
  positionTokenId: "YOUR_POSITION_TOKEN_ID"

channels:
  telegram:
    enabled: false
    botTokenEnv: "TELEGRAM_BOT_TOKEN"
    allowFrom: []
  whatsapp:
    enabled: false
    sessionDir: "~/.equalis/whatsapp"
    allowFrom: []
  discord:
    enabled: false
    botTokenEnv: "DISCORD_BOT_TOKEN"
    allowFrom: []
```

---

## 3.1) Optional: Channels (Telegram / Discord / WhatsApp)

Channels are optional. If enabled, Praxis can receive inbound messages and send replies.
All channels are allowlist-first by default. Only senders in `allowFrom` can trigger the agent.

### Telegram setup (polling or webhook)

1) Create a bot with **@BotFather** and copy the token.
2) Export the token:

```bash
export TELEGRAM_BOT_TOKEN=YOUR_TOKEN
```

3) Enable Telegram in config (polling example):

```yaml
channels:
  telegram:
    enabled: true
    botTokenEnv: "TELEGRAM_BOT_TOKEN"
    polling: true
    allowFrom:
      - "123456789"   # your Telegram user id
```

Notes:
- Webhook support is available via `src/cli/telegram-webhook-runner.ts`.
- Default path is `/telegram/webhook` on port `8080` (configurable).
- You can require mentions in groups with `requireMentionInGroups: true` and `mentionPatterns`.

### Discord setup (Gateway + REST)

1) Create a bot in the **Discord Developer Portal**.
2) Enable intents: **Server Members**, **Message Content**, **Direct Messages**.
3) Export the bot token:

```bash
export DISCORD_BOT_TOKEN=YOUR_TOKEN
```

4) Enable Discord in config:

```yaml
channels:
  discord:
    enabled: true
    botTokenEnv: "DISCORD_BOT_TOKEN"
    allowFrom:
      - "123456789012345678"   # your Discord user id
```

Optional (slash command interactions):
```yaml
channels:
  discord:
    publicKeyEnv: "DISCORD_PUBLIC_KEY"
```

### WhatsApp Cloud API setup (recommended)

1) Create a Meta app and enable **WhatsApp Cloud API**.
2) Get your **phone_number_id** and access token.
3) Export the token:

```bash
export WHATSAPP_ACCESS_TOKEN=YOUR_TOKEN
```

4) Enable WhatsApp in config (Cloud API uses phone_number_id as sessionDir):

```yaml
channels:
  whatsapp:
    enabled: true
    provider: "cloud"
    sessionDir: "YOUR_PHONE_NUMBER_ID"
    allowFrom:
      - "+15550001111"   # your phone number in E.164
```

Optional webhook signature verification:
```bash
export WHATSAPP_APP_SECRET=YOUR_APP_SECRET
```

---

## 4) Set your owner key (required)

You must set the owner private key in your shell before running. This key should control the Position NFT owner.

```bash
export PRAXIS_OWNER_KEY=0xYOUR_PRIVATE_KEY
```

IMPORTANT:
- This key is sensitive. Do not share it.
- The runtime never sends this key to external services.

---

## 5) Prepare local memory

Create memory folders:

```bash
mkdir -p ~/.equalis/agents/AGENT_ID/memory/weekly
mkdir -p ~/.equalis/agents/AGENT_ID/memory/decisions
nano ~/.equalis/agents/AGENT_ID/memory/MEMORY.md
```

Example `MEMORY.md`:

```markdown
# Constraints
- max slippage: 50 bps
- allowed pools: pool-1, pool-2

## [SENSITIVE] Wallets
- seed phrase: NEVER INCLUDE THIS
```

Note:
- Any section with `[SENSITIVE]` is excluded when external inference is enabled.

---

## 6) Install skill modules on the TBA (one-time)

Praxis does NOT install skills for you. You must install ERC-6900 execution modules on-chain.

Example skill:
- `PositionAgentAmmSkillModule` (AMM auctions + roll yield)

Steps:
1) Deploy the module.
2) Call `installExecution(moduleAddress, manifest, installData)` on the TBA.
3) Confirm installed selectors are visible via your TBA view interface.

Once installed, Praxis will only allow those selectors.

---

## 7) Run the agent (CLI)

From repo root:

```bash
node ./dist/cli/index.js --agent AGENT_ID --input "Roll yield on pool-1"
```

If you are running TypeScript directly (dev):

```bash
node --loader ts-node/esm src/cli/index.ts --agent AGENT_ID --input "Roll yield on pool-1"
```

The current CLI is a minimal MVP: it validates config/provider availability and runs a basic loop.

---

## 7.1) Check channel status (optional)

```bash
node ./dist/cli/channel-status.js --agent AGENT_ID
```

This reports missing tokens or disabled channels.

## 8) Where data is stored

```
~/.equalis/agents/AGENT_ID/
  config.yaml
  sessions.json
  transcripts/
  memory/
  logs/
```

---

## Troubleshooting

- **Config not found:** Ensure `config.yaml` exists in `~/.equalis/agents/AGENT_ID/`.
- **NoProviderAvailableError:** Ollama not running and external provider not enabled.
- **MissingModuleError:** The selector you want is not installed via ERC-6900.
- **Validation failed:** Constraints blocked the action.

---

## Safety notes

- This is an MVP. Always test on testnet first.
- Keep your private key secure.
- Only install trusted ERC-6900 modules.

---

## Roadmap ideas

- `praxis install-skill` helper
- Full inference planning (LLM-driven plans)
- UI/UX for module installation and constraints
