'use client';

import { useEffect, useState } from 'react';
import { Sparkle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ProfileChip } from '@/components/profile/ProfileChip';
import { Name } from '@/components/profile/Name';
import { formatCrc, formatRelative } from '@/lib/format';
import type { Round } from '@/lib/types';

interface GardenData {
  rounds: Round[];
  stats: { rounds: number; givers: number; totalCrc: number; gifts: number };
}

export function ImpactGarden() {
  const [data, setData] = useState<GardenData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/rounds');
        const json = (await res.json()) as GardenData;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setErr('could not load the garden.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (err) return <p className="mono text-sm text-muted-foreground">{err}</p>;

  if (!data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  const { rounds, stats } = data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: 'CRC shared', value: formatCrc(stats.totalCrc) },
          { label: 'gifts', value: stats.gifts },
          { label: 'givers', value: stats.givers },
        ].map((s) => (
          <div key={s.label} className="panel p-3 text-center">
            <p className="mono text-xl font-medium tabular-nums text-green">{s.value}</p>
            <p className="mono mt-0.5 text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {rounds.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="mono text-sm text-foreground">the garden is empty.</p>
          <p className="mono mt-1 text-xs text-muted-foreground">
            send the first generosity round and it blooms here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rounds.map((r) => (
            <li key={r.id} className="panel p-4">
              <div className="flex items-center justify-between gap-2">
                <ProfileChip address={r.from} variant="sm" />
                <div className="flex items-center gap-2">
                  {r.engine === 'gemini' && (
                    <span className="mono inline-flex items-center gap-1 rounded-full bg-green-soft px-2 py-0.5 text-[10px] text-green">
                      <Sparkle className="size-2.5" />
                      gemini
                    </span>
                  )}
                  <span className="mono text-[11px] text-muted-foreground">
                    {formatRelative(r.createdAt)}
                  </span>
                </div>
              </div>
              {r.mission && (
                <p className="mono mt-2 text-xs italic text-foreground/80">“{r.mission}”</p>
              )}
              <p className="mono mt-1 text-xs text-muted-foreground">{r.summary}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
                <span className="mono text-[11px] text-muted-foreground">
                  {formatCrc(r.total)} CRC · {r.allocations.length}:
                </span>
                {r.allocations.slice(0, 6).map((a) => (
                  <span
                    key={a.to}
                    title={a.reason}
                    className="mono inline-flex max-w-[10rem] items-center gap-1 rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] text-foreground"
                  >
                    <span className="tabular-nums text-green">{formatCrc(a.amount)}</span>
                    <span className="text-muted-foreground">→</span>
                    <Name address={a.to} className="truncate" />
                  </span>
                ))}
                {r.allocations.length > 6 && (
                  <span className="mono text-[10px] text-muted-foreground">
                    +{r.allocations.length - 6}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
