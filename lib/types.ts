/** Shared types for Manna. */

export type Hex = `0x${string}`;

/**
 * A candidate recipient surfaced from the connected user's trust graph,
 * enriched with everything the agent needs to reason about them. This is the
 * context we hand to Gemini — names, the trust relation, and any recent
 * signal — never private keys or balances beyond the user's own budget.
 */
export interface Candidate {
  address: Hex;
  /** Display name from the Circles profile, if resolved. */
  name?: string;
  /**
   * Trust relation from the connected user's point of view:
   *  - 'mutuallyTrusts' — strongest tie
   *  - 'trusts'         — user trusts them
   *  - 'trustedBy'      — they trust the user (can receive user's CRC directly)
   */
  relation: 'mutuallyTrusts' | 'trusts' | 'trustedBy';
  /** Optional free-text bio/description from their profile. */
  bio?: string;
  /** How many people trust this candidate (a rough reach/centrality signal). */
  inboundTrust?: number;
}

/** One proposed (or executed) gift inside a generosity round. */
export interface Allocation {
  to: Hex;
  /** Human CRC units, e.g. "3.5". */
  amount: string;
  /** One-line, human-readable reason the agent chose this recipient. */
  reason: string;
  /** Filled in once the transfer settles on-chain. */
  txHash?: Hex;
}

/** The agent's plan for a single round, before the user approves it. */
export interface RoundPlan {
  /** A warm one-paragraph summary of the agent's strategy this round. */
  summary: string;
  allocations: Allocation[];
  /** Total CRC the plan spends (sum of allocations). */
  total: number;
  /** Which engine produced this plan. */
  engine: 'gemini' | 'heuristic';
}

/** A round persisted to the impact garden after execution. */
export interface Round {
  id: string;
  /** The giver (connected user). */
  from: Hex;
  /** The mission text the user gave the agent. */
  mission: string;
  summary: string;
  allocations: Allocation[];
  total: number;
  engine: 'gemini' | 'heuristic';
  createdAt: number;
}

/** POST body for recording an executed round. */
export interface RecordRoundBody {
  from: Hex;
  mission: string;
  summary: string;
  allocations: Allocation[];
  engine: 'gemini' | 'heuristic';
  signature: Hex;
  signedMessage: string;
}

/** A live snapshot of an avatar's Circles state (status bar). */
export interface Snapshot {
  address: Hex;
  registered: boolean;
  type?: string;
  name?: string;
  /** Demurraged total CRC (TimeCircles), the figure the wallet shows. */
  totalCrc: number;
  trustsCount: number;
  trustedByCount: number;
}

/** A holding grouped by the avatar who issued the token. */
export interface Holding {
  issuer: Hex;
  name?: string;
  /** Demurraged CRC held of this issuer's token. */
  crc: number;
  isGroup: boolean;
}

/** A real transfer from the avatar's on-chain history. */
export interface Activity {
  hash: Hex;
  timestamp: number;
  from: Hex;
  to: Hex;
  /** Demurraged CRC value, display string. */
  crc: number;
  direction: 'in' | 'out' | 'mint' | 'self';
}

/** A representative route value takes across the trust graph (pathfinder). */
export interface TrustPath {
  /** Ordered avatar addresses: [from, ...intermediaries, to]. */
  hops: Hex[];
  /** Number of edges (1 = direct). */
  length: number;
  /** True when value flows straight from sender to recipient. */
  direct: boolean;
  /** Max CRC (human units) the pathfinder can currently route, if known. */
  maxFlow?: number;
  /** True when at least one path step was returned (false = estimated). */
  resolved: boolean;
}

/** POST body for asking the agent to plan a round. */
export interface PlanRoundBody {
  mission: string;
  /** Total CRC the user is willing to give this round. */
  budget: number;
  /** CRC to keep for themselves (informational, for the agent's tone). */
  buffer: number;
  candidates: Candidate[];
}
