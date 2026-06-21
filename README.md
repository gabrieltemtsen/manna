# Manna — live generosity agent for Circles

> In Exodus, manna was daily bread that **rotted if you hoarded it overnight.**
> On Circles, your basic income is the same: everyone mints ~1 CRC/hour, and it
> **demurrages ~7%/year** just by sitting in your wallet. Most people let it rot.

**Manna** is a [Circles](https://aboutcircles.com) embedded mini-app — a
**mission-control console** for an autonomous generosity agent. You tell it
what you care about in plain language; it reads your **real Circles trust
graph**, decides who to support (including people reached transitively through
the **pathfinder**), and proposes a round of gifts — each with a reason and a
**traced route**. You approve; it sends.

Everything is **live**. Trust graph, balances, token holdings, transaction
history and payment routes all come straight from the Circles RPC
(`https://rpc.aboutcircles.com/`) — no fixtures, no mocks.

## The console

A dark, real-time console with three live panels:

- **Agent console** — a terminal where you type intents and watch the agent
  read the graph, propose a round, and execute it line by line.
- **Trust graph** — a live minimap of your real circle; recipients in the
  current round light up and connect to you.
- **Holdings** — your real CRC, grouped by the avatar who issued each token.
- **Activity** — your real on-chain transfer history, with gnosisscan links.

### Live without a wallet

Circles reads need no wallet, so the console works standalone: **load any real
Circles avatar** (there are one-tap live samples) and every panel fills with
real on-chain data; the agent plans a real round and **traces real routes**
against the live pathfinder. Sending CRC requires the connected host wallet —
that's the one thing reads can't do.

## Why this can only exist on Circles

- **Decaying UBI (demurrage).** The agent has a real reason to act: idle CRC is
  actively losing value.
- **A trust graph.** It reasons over a real web of relationships, not strangers
  (`rpc.trust.getAggregatedTrustRelations`).
- **Transitive pathfinding.** CRC flows through chains of trust, so Manna can
  reach people you don't directly trust — and prove it
  (`rpc.pathfinder.findPath` returns the actual hop-by-hop flow, which the
  console renders as `you → … → recipient`).

## How the agent thinks

The brain is **Google Gemini** (`gemini-2.5-flash`, server-side so the key
never reaches the client). It receives your mission, a budget, and the real
candidate set (names, trust relation, reach), and returns a structured plan —
addresses, amounts, and a reason each. Plans are **sanitized**: only real
candidates, amounts clamped so a round never exceeds the budget. No key? A
transparent, budget-safe **heuristic** keeps the app working.

## Run it

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY (optional but recommended)
npm run dev
```

Open inside the Circles app to use your connected wallet (and send), or open
standalone and load an avatar to explore everything live.

### Environment

| var | purpose |
| --- | --- |
| `GEMINI_API_KEY` | The agent's brain. Free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Falls back to a heuristic if unset. |
| `GEMINI_MODEL` | Optional. Defaults to `gemini-2.5-flash`. |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Optional. Persists the Garden across cold starts; in-memory otherwise. |

## Architecture

| path | role |
| --- | --- |
| `lib/circles.ts` | LIVE data layer over the Circles RPC: `getSnapshot`, `buildCandidates`, `getHoldings`, `getActivity`, `findTrustPath` / `findMaxFlowTo`, `buildPathTransferTxs`, signature verification. |
| `components/session/SessionProvider.tsx` | Holds the active avatar (wallet or looked-up) and all live data; one place everything reads from. |
| `lib/agent.ts` | Gemini planner + heuristic fallback + budget-safe sanitization. |
| `app/api/agent` · `app/api/rounds` | Plan a round (key server-side) · record executed rounds (host-signed, EIP-1271 verified). |
| `components/manna/AgentConsole.tsx` | The terminal: intent → plan → approve → execute with live path receipts. |
| `components/manna/SidePanels.tsx` · `TrustGraphMinimap.tsx` · `TrustPath.tsx` | Live graph, holdings, activity, and the route tracer. |

## Safety model

- The agent only **proposes**; CRC moves only when you approve and the host
  wallet signs each transfer.
- Amounts are **clamped to your budget** client- and server-side.
- Recorded rounds are **authenticated**: the giver signs an attestation
  referencing the on-chain tx hashes, verified against their Safe.

---

Built on Circles Hub v2, Gnosis Chain. The on-chain transfers are the receipt;
the reasons — and the traced paths — are the soul.
