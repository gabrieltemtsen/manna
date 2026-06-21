/**
 * Manna's agent brain.
 *
 * Given a mission in plain language, a budget, and a set of candidates drawn
 * from the user's Circles trust graph, it decides *who* should receive CRC
 * and *why*. The reasoning happens in Gemini; if no key is configured (or the
 * call fails) we fall back to a transparent heuristic so the app always works
 * in a demo.
 *
 * The agent never moves money. It only proposes a plan; the user approves and
 * signs each transfer through the Circles host.
 */

import type { Allocation, Candidate, RoundPlan } from './types';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_KEY =
  process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';

/** Round to 2 dp and keep it positive. */
function clampAmount(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

/** Sum allocation amounts. */
function sumAlloc(allocs: Allocation[]): number {
  return clampAmount(allocs.reduce((s, a) => s + Number(a.amount || 0), 0));
}

function relationWeight(c: Candidate): number {
  // Stronger ties + a touch of reach get a larger default share.
  const base =
    c.relation === 'mutuallyTrusts' ? 3 : c.relation === 'trustedBy' ? 2 : 1;
  const reach = Math.min(2, (c.inboundTrust ?? 0) / 10);
  return base + reach;
}

/**
 * Heuristic planner — used when Gemini is unavailable. It is deliberately
 * simple and explainable: it ranks candidates by tie strength + reach, takes
 * the top handful, and splits the budget proportionally. Reasons are
 * templated but honest.
 */
export function heuristicPlan(
  mission: string,
  budget: number,
  candidates: Candidate[]
): RoundPlan {
  const pool = [...candidates]
    .sort((a, b) => relationWeight(b) - relationWeight(a))
    .slice(0, Math.min(5, candidates.length));

  if (pool.length === 0 || budget <= 0) {
    return {
      summary:
        'Manna couldn’t find anyone reachable in your trust graph to give to right now. Trust a few more people in Circles and try again.',
      allocations: [],
      total: 0,
      engine: 'heuristic',
    };
  }

  const totalWeight = pool.reduce((s, c) => s + relationWeight(c), 0);
  const shares = pool.map((c) =>
    clampAmount((relationWeight(c) / totalWeight) * budget)
  );
  // Per-gift 2dp rounding can push the sum a cent over budget — trim the
  // overflow off the largest gift so a round never exceeds what was approved.
  const overflow = clampAmount(shares.reduce((s, v) => s + v, 0) - budget);
  if (overflow > 0) {
    let maxIdx = 0;
    for (let i = 1; i < shares.length; i++)
      if (shares[i] > shares[maxIdx]) maxIdx = i;
    shares[maxIdx] = clampAmount(Math.max(0, shares[maxIdx] - overflow));
  }
  const allocations: Allocation[] = pool.map((c, idx) => {
    const share = shares[idx];
    const tie =
      c.relation === 'mutuallyTrusts'
        ? 'you and they trust each other'
        : c.relation === 'trustedBy'
          ? 'they already trust you, so your CRC lands directly'
          : 'someone you trust';
    return {
      to: c.address,
      amount: String(share),
      reason: `${c.name ?? 'A neighbour in your circle'} — ${tie}.`,
    };
  });

  return {
    summary: `Spreading ${sumAlloc(
      allocations
    )} CRC across ${allocations.length} people in your circle, weighted toward your closest ties before this manna spoils.`,
    allocations,
    total: sumAlloc(allocations),
    engine: 'heuristic',
  };
}

/** Compact candidate description for the prompt. */
function describeCandidate(c: Candidate, i: number): string {
  const rel =
    c.relation === 'mutuallyTrusts'
      ? 'mutual trust'
      : c.relation === 'trustedBy'
        ? 'they trust you (direct delivery)'
        : 'you trust them';
  const parts = [
    `${i + 1}. ${c.name ?? '(unnamed)'} [${c.address}]`,
    `relation: ${rel}`,
  ];
  if (typeof c.inboundTrust === 'number')
    parts.push(`trusted by ~${c.inboundTrust} others`);
  if (c.bio) parts.push(`bio: "${c.bio}"`);
  return parts.join(' · ');
}

const SYSTEM_INSTRUCTION = `You are Manna, an autonomous generosity agent operating on the Circles protocol.

Context you must understand:
- Circles gives every person a personal basic income (~1 CRC/hour) that DEMURRAGES: it loses about 7%/year just sitting there. Hoarding is literally wasteful — like manna, it spoils. Your purpose is to put a person's idle, spoiling CRC to good use according to their stated values.
- You can only give to people in the user's trust graph (provided as candidates). Value reaches them through chains of trust, so even people the user doesn't directly trust are reachable.
- "they trust you (direct delivery)" candidates are the most reliable to reach.

Your job: read the user's mission and pick a thoughtful subset of candidates to receive CRC this round, with a specific, warm, one-sentence reason for each that connects the choice to the mission and to the relationship. Be selective and intentional, not mechanical — it is fine to give to as few as 1 or as many as 8. Vary the amounts to reflect priority. Never exceed the budget. Reasons must be concrete and human, never generic filler. Write a short, warm summary of your strategy for the round.`;

interface GeminiAllocation {
  address: string;
  amount: number;
  reason: string;
}
interface GeminiResult {
  summary: string;
  allocations: GeminiAllocation[];
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    allocations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          amount: { type: 'number' },
          reason: { type: 'string' },
        },
        required: ['address', 'amount', 'reason'],
      },
    },
  },
  required: ['summary', 'allocations'],
};

/**
 * Plan a generosity round. Tries Gemini first; on any failure falls back to
 * the heuristic so the caller always gets a usable plan.
 */
export async function planRound(args: {
  mission: string;
  budget: number;
  buffer: number;
  candidates: Candidate[];
}): Promise<RoundPlan> {
  const { mission, budget, buffer, candidates } = args;

  if (!GEMINI_KEY || candidates.length === 0 || budget <= 0) {
    return heuristicPlan(mission, budget, candidates);
  }

  const byAddress = new Map(candidates.map((c) => [c.address.toLowerCase(), c]));

  const userPrompt = [
    `MISSION (the user's own words): "${mission || 'Be generous to whoever needs it most.'}"`,
    ``,
    `BUDGET: ${budget} CRC total to give this round. Do not exceed it.`,
    `The user is keeping ${buffer} CRC for themselves.`,
    ``,
    `CANDIDATES (only choose from these, by exact address):`,
    ...candidates.map(describeCandidate),
    ``,
    `Return your plan as JSON: a "summary" and an "allocations" array of {address, amount, reason}. Use exact addresses from the list above. Amounts in CRC, summing to at most the budget.`,
  ].join('\n');

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
      // Don't let a slow model hang the request forever.
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) {
      console.warn('[manna/agent] gemini http error', res.status, await res.text());
      return heuristicPlan(mission, budget, candidates);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return heuristicPlan(mission, budget, candidates);

    const parsed = JSON.parse(text) as GeminiResult;

    // Sanitize: keep only real candidates, clamp amounts, enforce budget.
    const clean: Allocation[] = [];
    let running = 0;
    for (const a of parsed.allocations ?? []) {
      const cand = byAddress.get((a.address || '').toLowerCase());
      if (!cand) continue;
      let amt = clampAmount(Number(a.amount));
      if (amt <= 0) continue;
      // Clamp so the running total never exceeds budget.
      if (running + amt > budget) amt = clampAmount(budget - running);
      if (amt <= 0) break;
      running += amt;
      clean.push({
        to: cand.address,
        amount: String(amt),
        reason: (a.reason || '').trim() || `For ${cand.name ?? 'someone in your circle'}.`,
      });
    }

    if (clean.length === 0) return heuristicPlan(mission, budget, candidates);

    return {
      summary:
        (parsed.summary || '').trim() ||
        `A generosity round of ${sumAlloc(clean)} CRC across ${clean.length} people in your circle.`,
      allocations: clean,
      total: sumAlloc(clean),
      engine: 'gemini',
    };
  } catch (err) {
    console.warn('[manna/agent] gemini failed, using heuristic:', err);
    return heuristicPlan(mission, budget, candidates);
  }
}
