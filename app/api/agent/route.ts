import { NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { planRound } from '@/lib/agent';
import type { Candidate, PlanRoundBody } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent — ask Manna to plan a generosity round.
 *
 * The client gathers candidates from the trust graph (it already has the
 * connected address and the Circles SDK) and posts them here so the Gemini
 * key stays server-side. We validate, plan, and return the proposal — no
 * money moves until the user approves and signs on the client.
 */
export async function POST(req: Request) {
  let body: PlanRoundBody;
  try {
    body = (await req.json()) as PlanRoundBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const budget = Number(body.budget);
  const buffer = Number(body.buffer) || 0;
  if (!Number.isFinite(budget) || budget <= 0) {
    return NextResponse.json({ error: 'Invalid budget' }, { status: 400 });
  }

  const mission = (body.mission ?? '').toString().slice(0, 1000);

  // Validate + dedupe candidates.
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const c of body.candidates ?? []) {
    if (!c || !isAddress(c.address)) continue;
    const key = c.address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      address: c.address.toLowerCase() as Candidate['address'],
      name: typeof c.name === 'string' ? c.name.slice(0, 80) : undefined,
      relation:
        c.relation === 'mutuallyTrusts' ||
        c.relation === 'trustedBy' ||
        c.relation === 'trusts'
          ? c.relation
          : 'trusts',
      bio: typeof c.bio === 'string' ? c.bio.slice(0, 200) : undefined,
      inboundTrust:
        typeof c.inboundTrust === 'number' ? c.inboundTrust : undefined,
    });
  }

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: 'No valid candidates in trust graph' },
      { status: 400 }
    );
  }

  const plan = await planRound({ mission, budget, buffer, candidates });
  return NextResponse.json({ plan });
}
