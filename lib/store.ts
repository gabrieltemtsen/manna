/**
 * Round storage for Manna's impact garden.
 *
 * Two implementations behind one async interface:
 *  - In-memory map (default) — perfect for local dev and demos.
 *  - Upstash Redis (when env vars are present) — survives serverless cold
 *    starts on Vercel.
 */

import { Redis } from '@upstash/redis';
import type { Round } from './types';

const memStore: Map<string, Round> = (
  globalThis as unknown as { __mannaMem?: Map<string, Round> }
).__mannaMem ?? new Map<string, Round>();
(globalThis as unknown as { __mannaMem?: Map<string, Round> }).__mannaMem =
  memStore;

const redis: Redis | null = (() => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
})();

const KEY_ROUND = (id: string) => `manna:round:${id}`;
const KEY_INDEX = 'manna:rounds';
const KEY_BY_GIVER = (addr: string) => `manna:giver:${addr.toLowerCase()}`;

export async function putRound(round: Round): Promise<void> {
  if (redis) {
    await redis.set(KEY_ROUND(round.id), JSON.stringify(round));
    await redis.zadd(KEY_INDEX, { score: round.createdAt, member: round.id });
    await redis.zadd(KEY_BY_GIVER(round.from), {
      score: round.createdAt,
      member: round.id,
    });
  } else {
    memStore.set(round.id, round);
  }
}

export async function getRound(id: string): Promise<Round | null> {
  if (redis) {
    const raw = await redis.get<string | Round>(KEY_ROUND(id));
    if (!raw) return null;
    return typeof raw === 'string' ? (JSON.parse(raw) as Round) : raw;
  }
  return memStore.get(id) ?? null;
}

export async function listRecentRounds(limit = 36): Promise<Round[]> {
  if (redis) {
    const ids =
      (await redis.zrange<string[]>(KEY_INDEX, 0, limit - 1, { rev: true })) ??
      [];
    const rounds: Round[] = [];
    for (const id of ids) {
      const r = await getRound(id);
      if (r) rounds.push(r);
    }
    return rounds;
  }
  return Array.from(memStore.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

/** Aggregate stats for the garden header. */
export async function gardenStats(): Promise<{
  rounds: number;
  givers: number;
  totalCrc: number;
  gifts: number;
}> {
  const rounds = await listRecentRounds(500);
  const givers = new Set(rounds.map((r) => r.from.toLowerCase()));
  let totalCrc = 0;
  let gifts = 0;
  for (const r of rounds) {
    totalCrc += r.total;
    gifts += r.allocations.length;
  }
  return {
    rounds: rounds.length,
    givers: givers.size,
    totalCrc: Math.round(totalCrc * 100) / 100,
    gifts,
  };
}
