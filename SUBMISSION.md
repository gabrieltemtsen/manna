# Manna — submission

**One line:** A live mission-control console for an autonomous AI agent that
reads your real Circles trust graph and turns your *decaying* basic income into
intentional, traceable gifts — you approve, it sends.

## The hook

> Your Circles UBI is bread that rots if you hoard it — ~7%/year, every second.
> Manna is an agent you give a mission to. It reads your real trust graph,
> decides who to support and why, traces the exact route each gift takes through
> the graph, and sends it on your approval. Everything on screen is live.

## Why it wins

- **Genuinely live.** Trust graph, balances, holdings, transaction history and
  payment routes all stream from the Circles RPC. No mock data anywhere. You can
  load any real avatar and watch it populate.
- **Agent-driven.** Gemini reasons over a real social graph and produces a
  concrete, defensible allocation with a reason per recipient.
- **Leverages the dev stack.** The trust-path tracer surfaces
  `rpc.pathfinder.findPath`'s actual flow — `you → … → recipient` — something
  most apps never expose. Holdings group real `getTokenBalances`; activity is
  real `getTransactionHistory`.
- **Impossible off Circles.** Needs demurrage (a reason to act), a trust graph
  (who), and transitive pathfinding (how) at once.

## 60-second demo

1. Open standalone → tap a **live sample avatar**. Status bar shows its real
   balance + per-second decay; the trust graph, holdings, and activity panels
   fill with real on-chain data.
2. In the console, type a mission (or tap a preset) and a budget. Hit run.
3. The agent streams its reasoning, then proposes a round — recipients **light
   up on the live graph**. Expand **trace route** on any gift to see the real
   pathfinder hops + max routable CRC.
4. Inside the Circles app: **approve & send** → each transfer routes through the
   pathfinder, settles on-chain (gnosisscan receipts), and the round is signed
   and logged to the Garden. Standalone: **trace routes** does a live dry-run.

## UI/UX

Dark "mission control" terminal — monospace data, live status bar, streaming
agent log, an interactive plan card, and three real-time panels. Short in-console
intro + tooltips orient first-time users. Zero extra UI deps.

## Tech

Next.js 16 · viem · `@aboutcircles/miniapp-sdk` + `@aboutcircles/sdk`
(`rpc.profile`, `rpc.trust`, `rpc.balance`, `rpc.transaction`, `rpc.pathfinder`,
`sdk-transfers`) · Gemini `gemini-2.5-flash` (server-side, budget-safe heuristic
fallback) · Upstash Redis for the Garden · Hub v2 on Gnosis Chain.

## Verification

- `tsc --noEmit` passes clean across the app.
- Agent core: budget + shape invariant holds over 3000 randomized runs;
  demurrage confirmed at 7.00%/yr; empty-graph handled.
- Live RPC path uses documented SDK methods (verified against the Circles docs).
  The build sandbox can't reach `rpc.aboutcircles.com`, so live data renders in
  the browser at `npm run dev`.
