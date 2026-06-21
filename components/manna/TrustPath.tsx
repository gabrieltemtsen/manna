'use client';

import { useState } from 'react';
import { Loader2, Route, Zap } from 'lucide-react';
import { formatCrc } from '@/lib/format';
import { useName } from '@/components/profile/Name';
import type { Hex, TrustPath as TrustPathData } from '@/lib/types';

/**
 * "Trace route" for a gift — LIVE. Calls the real Circles pathfinder
 * (rpc.pathfinder.findPath, a read-only call that works with no wallet) and
 * renders the actual hops the CRC takes across the trust graph, plus the max
 * routable amount. The dev-tools showpiece, on real data.
 */
export function TrustPath({
  from,
  to,
  toName,
  amount,
}: {
  from: Hex | null;
  to: Hex;
  toName?: string;
  amount: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [path, setPath] = useState<TrustPathData | null>(null);

  async function trace() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (path || !from) return;
    setLoading(true);
    try {
      const { findTrustPath } = await import('@/lib/circles');
      setPath(await findTrustPath({ from, to, amount }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-1.5">
      <button
        onClick={trace}
        disabled={!from}
        className="mono inline-flex items-center gap-1.5 rounded border border-border bg-secondary/40 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
      >
        {loading ? <Loader2 className="size-3 animate-spin" /> : <Route className="size-3" />}
        {open ? 'hide route' : 'trace route'}
      </button>

      {open && path && (
        <div className="log-in mt-1.5 rounded-md border border-border bg-background/60 p-2">
          <div className="flex flex-wrap items-center gap-1">
            {path.hops.map((h, i) => {
              const isFirst = i === 0;
              const isLast = i === path.hops.length - 1;
              return (
                <span key={`${h}-${i}`} className="flex items-center gap-1">
                  <HopChip
                    address={h}
                    label={isFirst ? 'you' : isLast ? toName : undefined}
                    tone={isFirst ? 'green' : isLast ? 'amber' : 'plain'}
                  />
                  {!isLast && <span className="text-green">→</span>}
                </span>
              );
            })}
          </div>
          <p className="mono mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
            {path.direct ? (
              <span className="flex items-center gap-1 text-green">
                <Zap className="size-3" /> direct · they trust you
              </span>
            ) : (
              <span>
                routed through <span className="text-foreground">{path.length}</span> hops
              </span>
            )}
            {typeof path.maxFlow === 'number' && (
              <span className="ml-auto">max {formatCrc(path.maxFlow)} CRC</span>
            )}
            {!path.resolved && <span className="ml-auto italic">est.</span>}
          </p>
        </div>
      )}
    </div>
  );
}

/** A single hop chip; resolves the avatar's name unless a label is forced. */
function HopChip({
  address,
  label,
  tone,
}: {
  address: Hex;
  label?: string;
  tone: 'green' | 'amber' | 'plain';
}) {
  const resolved = useName(address);
  const text = label ?? resolved;
  const cls =
    tone === 'green'
      ? 'bg-green-soft text-green'
      : tone === 'amber'
        ? 'bg-amber-soft text-amber'
        : 'border border-border text-foreground';
  return (
    <span className={`mono max-w-[8rem] truncate rounded px-1.5 py-0.5 text-[10px] ${cls}`}>
      {text}
    </span>
  );
}
