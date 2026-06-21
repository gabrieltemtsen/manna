/**
 * Circles protocol layer for Manna — LIVE on Gnosis Chain.
 *
 * Everything here reads real data from the public Circles RPC
 * (https://rpc.aboutcircles.com/) via the Circles SDK — no fixtures, no
 * mocks. Reads work for ANY avatar with no wallet, so the agent reasons over
 * a real trust graph whether or not we're inside the Circles host. Writes are
 * encoded as calldata and routed through the host Safe via the miniapp SDK.
 *
 * Docs: https://docs.aboutcircles.com
 *   · rpc.balance.getTokenBalances / getTotalBalance
 *   · rpc.trust.getAggregatedTrustRelations
 *   · rpc.transaction.getTransactionHistory
 *   · rpc.profile.getProfileView / getProfileByAddressBatch
 *   · rpc.pathfinder.findPath / findMaxFlow
 */

import {
  createPublicClient,
  http,
  isAddress,
  parseUnits,
  type Address,
  type Hex,
} from 'viem';
import { gnosis } from 'viem/chains';
import { TransferBuilder } from '@aboutcircles/sdk-transfers';
import { circlesConfig } from '@aboutcircles/sdk-utils';
import type {
  Activity,
  Candidate,
  Holding,
  Snapshot,
  TrustPath,
} from './types';

export const HUB_V2_ADDRESS: Address =
  '0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8';
export const CRC_DECIMALS = 18;
const GNOSIS_CHAIN_ID = 100;

/** viem client — only used for signature verification (EIP-1271). */
export const publicClient = createPublicClient({
  chain: gnosis,
  transport: http('https://rpc.gnosischain.com'),
});

export function addressToTokenId(address: Address): bigint {
  return BigInt(address);
}

// ─── Shared SDK singleton (read-only) ────────────────────────────────────────

type AnySdk = {
  rpc: {
    balance: {
      getTokenBalances: (a: Address) => Promise<RawTokenBalance[]>;
    };
    trust: {
      getAggregatedTrustRelations: (a: Address) => Promise<RawTrustRel[]>;
    };
    transaction: {
      getTransactionHistory: (
        a: Address,
        limit?: number
      ) => Promise<{ results: RawTxRow[] }>;
    };
    profile: {
      getProfileView: (a: Address) => Promise<RawProfileView>;
      getProfileByAddress: (a: Address) => Promise<RawProfile | null>;
      getProfileByAddressBatch: (
        a: (Address | null)[]
      ) => Promise<(RawProfile | null)[]>;
    };
    pathfinder: {
      findPath: (p: {
        from: Address;
        to: Address;
        targetFlow: bigint;
      }) => Promise<{ maxFlow?: bigint; transfers?: RawTransferStep[] }>;
      findMaxFlow: (p: { from: Address; to: Address }) => Promise<bigint>;
    };
  };
};

interface RawTokenBalance {
  tokenOwner: Address;
  tokenType?: string;
  circles: number;
  isGroup?: boolean;
}
interface RawTrustRel {
  subjectAvatar: Address;
  relation: string;
  objectAvatar: Address;
}
interface RawTxRow {
  transactionHash: Hex;
  timestamp: number;
  from: Address;
  to: Address;
  circles: string;
}
interface RawProfile {
  name?: string;
  description?: string;
}
interface RawProfileView {
  avatarInfo?: { version?: number; type?: string };
  profile?: RawProfile;
  trustStats?: { trustsCount?: number; trustedByCount?: number };
}
interface RawTransferStep {
  from: string;
  to: string;
  tokenOwner: string;
  value: bigint | string;
}

let _sdk: AnySdk | null = null;
async function getSdk(): Promise<AnySdk> {
  if (!_sdk) {
    const { Sdk } = await import('@aboutcircles/sdk');
    _sdk = new Sdk() as unknown as AnySdk;
  }
  return _sdk;
}

const ZERO = '0x0000000000000000000000000000000000000000';

// ─── Live snapshot (status bar) ──────────────────────────────────────────────

/**
 * One-call live snapshot: registration, name, demurraged balance, trust counts.
 * Balance is summed from real token holdings (`circles` = demurraged value).
 */
export async function getSnapshot(address: Address): Promise<Snapshot> {
  const out: Snapshot = {
    address: address.toLowerCase() as Hex,
    registered: false,
    totalCrc: 0,
    trustsCount: 0,
    trustedByCount: 0,
  };
  if (!isAddress(address)) return out;
  try {
    const sdk = await getSdk();
    const [view, balances] = await Promise.all([
      sdk.rpc.profile.getProfileView(address).catch(() => null),
      sdk.rpc.balance.getTokenBalances(address).catch(() => [] as RawTokenBalance[]),
    ]);
    if (view) {
      out.registered = !!view.avatarInfo && (view.avatarInfo.version ?? 0) >= 1;
      out.type = view.avatarInfo?.type;
      out.name = view.profile?.name?.trim() || undefined;
      out.trustsCount = view.trustStats?.trustsCount ?? 0;
      out.trustedByCount = view.trustStats?.trustedByCount ?? 0;
    }
    out.totalCrc =
      Math.round(
        (balances ?? []).reduce((s, b) => s + (Number(b.circles) || 0), 0) * 100
      ) / 100;
  } catch {
    /* keep defaults */
  }
  return out;
}

// ─── Profile name resolution (shared, cached) ────────────────────────────────

const _nameCache = new Map<string, string | undefined>();
const _nameInflight = new Map<string, Promise<string | undefined>>();

/** Resolve a single avatar's display name (cached). Undefined if unnamed. */
export async function getProfileName(
  address: Address
): Promise<string | undefined> {
  const key = address.toLowerCase();
  if (_nameCache.has(key)) return _nameCache.get(key);
  if (_nameInflight.has(key)) return _nameInflight.get(key)!;
  const p = (async () => {
    try {
      const sdk = await getSdk();
      const prof = await sdk.rpc.profile.getProfileByAddress(address);
      const name = prof?.name?.trim() || undefined;
      _nameCache.set(key, name);
      return name;
    } catch {
      _nameCache.set(key, undefined);
      return undefined;
    } finally {
      _nameInflight.delete(key);
    }
  })();
  _nameInflight.set(key, p);
  return p;
}

// ─── Trust graph → candidates ────────────────────────────────────────────────

/**
 * Build the agent's candidate set from the avatar's real trust graph. Names
 * are resolved in one batch; inbound-trust (a reach signal) is fetched for the
 * shortlist. Strongest ties first.
 */
export async function buildCandidates(
  address: Address,
  limit = 18
): Promise<Candidate[]> {
  const sdk = await getSdk();
  const rels =
    (await sdk.rpc.trust
      .getAggregatedTrustRelations(address)
      .catch(() => [] as RawTrustRel[])) ?? [];

  const seen = new Set<string>();
  const base: Candidate[] = [];
  for (const r of rels) {
    const a = r.objectAvatar?.toLowerCase();
    if (!a || a === address.toLowerCase()) continue;
    if (
      r.relation !== 'trusts' &&
      r.relation !== 'trustedBy' &&
      r.relation !== 'mutuallyTrusts'
    ) {
      continue;
    }
    if (seen.has(a)) continue;
    seen.add(a);
    base.push({ address: a as Hex, relation: r.relation });
  }

  const order = { mutuallyTrusts: 0, trustedBy: 1, trusts: 2 } as const;
  base.sort((x, y) => order[x.relation] - order[y.relation]);
  const shortlist = base.slice(0, limit);
  if (shortlist.length === 0) return shortlist;

  // Names in one batch.
  try {
    const profiles = await sdk.rpc.profile.getProfileByAddressBatch(
      shortlist.map((c) => c.address as Address)
    );
    profiles.forEach((p, i) => {
      const name = p?.name?.trim();
      if (name) shortlist[i].name = name;
      const bio = p?.description?.trim();
      if (bio) shortlist[i].bio = bio.slice(0, 160);
    });
  } catch {
    /* names optional */
  }

  // Inbound-trust (reach) for the shortlist, in parallel.
  await Promise.all(
    shortlist.map(async (c) => {
      try {
        const v = await sdk.rpc.profile.getProfileView(c.address as Address);
        c.inboundTrust = v?.trustStats?.trustedByCount ?? undefined;
      } catch {
        /* optional */
      }
    })
  );

  return shortlist;
}

// ─── Token holdings ──────────────────────────────────────────────────────────

/** Top token holdings grouped by issuer, demurraged, names resolved. */
export async function getHoldings(
  address: Address,
  top = 6
): Promise<Holding[]> {
  try {
    const sdk = await getSdk();
    const balances =
      (await sdk.rpc.balance.getTokenBalances(address).catch(() => [])) ?? [];
    const byIssuer = new Map<string, Holding>();
    for (const b of balances) {
      const issuer = (b.tokenOwner || ZERO).toLowerCase();
      const crc = Number(b.circles) || 0;
      if (crc <= 0) continue;
      const isGroup = (b.tokenType || '').toLowerCase().includes('group') || !!b.isGroup;
      const cur = byIssuer.get(issuer);
      if (cur) cur.crc += crc;
      else byIssuer.set(issuer, { issuer: issuer as Hex, crc, isGroup });
    }
    const list = Array.from(byIssuer.values())
      .map((h) => ({ ...h, crc: Math.round(h.crc * 100) / 100 }))
      .sort((a, b) => b.crc - a.crc)
      .slice(0, top);

    try {
      const profiles = await sdk.rpc.profile.getProfileByAddressBatch(
        list.map((h) => h.issuer as Address)
      );
      profiles.forEach((p, i) => {
        const name = p?.name?.trim();
        if (name) list[i].name = name;
      });
    } catch {
      /* names optional */
    }
    return list;
  } catch {
    return [];
  }
}

// ─── Activity feed ───────────────────────────────────────────────────────────

/** Recent real transfers for the avatar. */
export async function getActivity(
  address: Address,
  limit = 8
): Promise<Activity[]> {
  try {
    const sdk = await getSdk();
    const page = await sdk.rpc.transaction.getTransactionHistory(address, limit);
    const me = address.toLowerCase();
    return (page?.results ?? []).map((r) => {
      const from = (r.from || ZERO).toLowerCase();
      const to = (r.to || ZERO).toLowerCase();
      const direction: Activity['direction'] =
        from === ZERO
          ? 'mint'
          : from === me && to === me
            ? 'self'
            : to === me
              ? 'in'
              : 'out';
      return {
        hash: r.transactionHash,
        timestamp: Number(r.timestamp) * (String(r.timestamp).length <= 10 ? 1000 : 1),
        from: from as Hex,
        to: to as Hex,
        crc: Math.round((Number(r.circles) || 0) * 100) / 100,
        direction,
      };
    });
  } catch {
    return [];
  }
}

// ─── Pathfinder: route + capacity ────────────────────────────────────────────

function chainFromTransfers(
  from: Address,
  to: Address,
  transfers: RawTransferStep[]
): Address[] {
  const src = from.toLowerCase();
  const sink = to.toLowerCase();
  const adj = new Map<string, Array<{ to: string; value: bigint }>>();
  for (const t of transfers) {
    const f = t.from.toLowerCase();
    const tt = t.to.toLowerCase();
    const v = typeof t.value === 'string' ? BigInt(t.value || '0') : t.value;
    if (!adj.has(f)) adj.set(f, []);
    adj.get(f)!.push({ to: tt, value: v });
  }
  for (const list of adj.values()) list.sort((a, b) => (b.value > a.value ? 1 : -1));

  const chain: string[] = [src];
  const visited = new Set<string>([src]);
  let cur = src;
  for (let guard = 0; guard < 12; guard++) {
    if (cur === sink) break;
    const next = (adj.get(cur) ?? []).find((e) => !visited.has(e.to));
    if (!next) break;
    chain.push(next.to);
    visited.add(next.to);
    cur = next.to;
  }
  if (chain[chain.length - 1] !== sink) chain.push(sink);
  return chain as Address[];
}

/** Resolve the real route the pathfinder uses to move `amount` CRC. */
export async function findTrustPath(args: {
  from: Address;
  to: Address;
  amount: string | number;
}): Promise<TrustPath> {
  const fallback: TrustPath = {
    hops: [args.from, args.to],
    length: 1,
    direct: true,
    resolved: false,
  };
  try {
    const sdk = await getSdk();
    const targetFlow = parseUnits(String(args.amount), CRC_DECIMALS);
    const result = await sdk.rpc.pathfinder.findPath({
      from: args.from,
      to: args.to,
      targetFlow,
    });
    const transfers = result?.transfers ?? [];
    if (transfers.length === 0) return fallback;
    const hops = chainFromTransfers(args.from, args.to, transfers);
    const maxFlow =
      typeof result.maxFlow === 'bigint'
        ? Number(result.maxFlow) / 10 ** CRC_DECIMALS
        : undefined;
    return {
      hops,
      length: Math.max(1, hops.length - 1),
      direct: hops.length <= 2,
      maxFlow,
      resolved: true,
    };
  } catch {
    return fallback;
  }
}

/** Max CRC currently routable from `from` to `to`, or null. */
export async function findMaxFlowTo(
  from: Address,
  to: Address
): Promise<number | null> {
  try {
    const sdk = await getSdk();
    const max = await sdk.rpc.pathfinder.findMaxFlow({ from, to });
    return Number(max) / 10 ** CRC_DECIMALS;
  } catch {
    return null;
  }
}

// ─── Transfers (encode → host Safe) ──────────────────────────────────────────

let _transferBuilder: TransferBuilder | null = null;
function getTransferBuilder(): TransferBuilder {
  if (!_transferBuilder) {
    _transferBuilder = new TransferBuilder(circlesConfig[GNOSIS_CHAIN_ID]);
  }
  return _transferBuilder;
}

/** Build a path-based CRC transfer (flow matrix) to hand to sendTransactions. */
export async function buildPathTransferTxs(args: {
  from: Address;
  to: Address;
  amount: string | number;
}): Promise<Array<{ to: Address; data: Hex; value: string }>> {
  const amountWei = parseUnits(String(args.amount), CRC_DECIMALS);
  const builder = getTransferBuilder();
  const txs = await builder.constructAdvancedTransfer(
    args.from,
    args.to,
    amountWei
  );
  return txs.map((t) => ({
    to: t.to,
    data: t.data,
    value: t.value.toString(),
  }));
}

/** Verify an EIP-1271 / personal signature against a Safe — authenticates writes. */
export async function verifyHostSignature(args: {
  signer: Address;
  message: string;
  signature: Hex;
}): Promise<boolean> {
  try {
    return await publicClient.verifyMessage({
      address: args.signer,
      message: args.message,
      signature: args.signature,
    });
  } catch {
    return false;
  }
}
