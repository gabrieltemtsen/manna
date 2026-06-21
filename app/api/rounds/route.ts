import { NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { verifyHostSignature } from '@/lib/circles';
import { gardenStats, listRecentRounds, putRound } from '@/lib/store';
import { shortId } from '@/lib/format';
import type { Allocation, Hex, RecordRoundBody, Round } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/rounds — the impact garden feed + aggregate stats. */
export async function GET() {
  const [rounds, stats] = await Promise.all([
    listRecentRounds(36),
    gardenStats(),
  ]);
  return NextResponse.json({ rounds, stats });
}

/**
 * POST /api/rounds — record an executed generosity round.
 *
 * Authenticated the same way Bless authenticates writes: the giver signs an
 * attestation with the host wallet, and we verify the signature on-chain
 * (EIP-1271 against their Safe) before trusting the submission.
 */
export async function POST(req: Request) {
  let body: RecordRoundBody;
  try {
    body = (await req.json()) as RecordRoundBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { from, mission, summary, allocations, engine, signature, signedMessage } =
    body;

  if (!isAddress(from)) {
    return NextResponse.json({ error: 'Invalid giver address' }, { status: 400 });
  }
  if (!Array.isArray(allocations) || allocations.length === 0) {
    return NextResponse.json({ error: 'No allocations' }, { status: 400 });
  }

  // Validate each allocation. Only persist gifts that actually settled.
  const clean: Allocation[] = [];
  let total = 0;
  for (const a of allocations) {
    if (!a || !isAddress(a.to)) continue;
    const amt = Number(a.amount);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    if (!a.txHash || !/^0x[a-fA-F0-9]{64}$/.test(a.txHash)) continue;
    total += amt;
    clean.push({
      to: a.to.toLowerCase() as Hex,
      amount: String(Math.round(amt * 100) / 100),
      reason: (a.reason ?? '').toString().slice(0, 280),
      txHash: a.txHash as Hex,
    });
  }
  if (clean.length === 0) {
    return NextResponse.json(
      { error: 'No settled allocations to record' },
      { status: 400 }
    );
  }

  // Verify the giver signed this round.
  const sigOk = await verifyHostSignature({
    signer: from as Hex,
    message: signedMessage,
    signature: signature as Hex,
  });
  if (!sigOk) {
    return NextResponse.json(
      { error: 'Signature does not match giver' },
      { status: 401 }
    );
  }
  // The signed message must reference at least one of the recorded tx hashes,
  // so a giver can't relay an unrelated signature.
  const referencesATx = clean.some((a) => signedMessage.includes(a.txHash!));
  if (!referencesATx) {
    return NextResponse.json(
      { error: 'Signed message does not match payload' },
      { status: 400 }
    );
  }

  const round: Round = {
    id: shortId(6),
    from: from.toLowerCase() as Hex,
    mission: (mission ?? '').toString().slice(0, 1000),
    summary: (summary ?? '').toString().slice(0, 600),
    allocations: clean,
    total: Math.round(total * 100) / 100,
    engine: engine === 'gemini' ? 'gemini' : 'heuristic',
    createdAt: Date.now(),
  };
  await putRound(round);
  return NextResponse.json({ id: round.id, round });
}
