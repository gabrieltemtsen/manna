'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useWallet } from '@/hooks/use-wallet';
import type { Activity, Candidate, Holding, Hex, Snapshot } from '@/lib/types';

/**
 * The live session. The "active" avatar is the connected host wallet if we're
 * inside the Circles app; otherwise it's whatever real address the user looks
 * up. Either way, all data below is fetched live from the Circles RPC — no
 * fixtures. Only a wallet-sourced session can sign and send.
 */
interface SessionValue {
  address: Hex | null;
  /** Where the active address came from. */
  source: 'wallet' | 'lookup' | null;
  /** True only when we can actually sign + send (connected host wallet). */
  canSend: boolean;
  loading: boolean;
  snapshot: Snapshot | null;
  candidates: Candidate[];
  holdings: Holding[];
  activity: Activity[];
  lookup: (addr: string) => void;
  clearLookup: () => void;
  refresh: () => void;
}

const SessionContext = createContext<SessionValue>({
  address: null,
  source: null,
  canSend: false,
  loading: false,
  snapshot: null,
  candidates: [],
  holdings: [],
  activity: [],
  lookup: () => {},
  clearLookup: () => {},
  refresh: () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const { address: walletAddress } = useWallet();
  const [lookupAddr, setLookupAddr] = useState<Hex | null>(null);
  const [tick, setTick] = useState(0);

  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);

  // Wallet wins; otherwise use the looked-up address.
  const address = (walletAddress as Hex | null) ?? lookupAddr;
  const source: SessionValue['source'] = walletAddress
    ? 'wallet'
    : lookupAddr
      ? 'lookup'
      : null;

  useEffect(() => {
    if (!address) {
      setSnapshot(null);
      setCandidates([]);
      setHoldings([]);
      setActivity([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const circles = await import('@/lib/circles');
        const [snap, cands, hold, act] = await Promise.all([
          circles.getSnapshot(address),
          circles.buildCandidates(address),
          circles.getHoldings(address),
          circles.getActivity(address),
        ]);
        if (cancelled) return;
        setSnapshot(snap);
        setCandidates(cands);
        setHoldings(hold);
        setActivity(act);
      } catch {
        /* leave whatever loaded */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, tick]);

  const lookup = useCallback((addr: string) => {
    const a = addr.trim().toLowerCase();
    if (/^0x[a-f0-9]{40}$/.test(a)) setLookupAddr(a as Hex);
  }, []);
  const clearLookup = useCallback(() => setLookupAddr(null), []);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return (
    <SessionContext.Provider
      value={{
        address,
        source,
        canSend: source === 'wallet',
        loading,
        snapshot,
        candidates,
        holdings,
        activity,
        lookup,
        clearLookup,
        refresh,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
