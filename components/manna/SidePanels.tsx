'use client';

import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Network,
  Repeat,
  Sparkle,
  Activity as ActivityIcon,
} from 'lucide-react';
import { useSession } from '@/components/session/SessionProvider';
import { TrustGraphMinimap } from '@/components/manna/TrustGraphMinimap';
import { ProfileChip } from '@/components/profile/ProfileChip';
import { formatCrc, formatRelative, shortenAddress } from '@/lib/format';
import type { Activity } from '@/lib/types';

function PanelHead({
  icon: Icon,
  title,
  right,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="mono flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5 text-green" />
        {title}
      </span>
      {right}
    </div>
  );
}

/** Live trust graph + reachable count. */
export function GraphPanel({ highlighted }: { highlighted?: Set<string> }) {
  const { candidates } = useSession();
  return (
    <div className="panel p-4">
      <PanelHead
        icon={Network}
        title="trust graph"
        right={
          <span className="mono text-[11px] text-foreground">
            {candidates.length} reachable
          </span>
        }
      />
      <TrustGraphMinimap candidates={candidates} highlighted={highlighted} />
    </div>
  );
}

/** Live token holdings grouped by issuer. */
export function HoldingsPanel() {
  const { holdings } = useSession();
  return (
    <div className="panel p-4">
      <PanelHead icon={Coins} title="holdings" />
      {holdings.length === 0 ? (
        <p className="mono py-2 text-xs text-muted-foreground">no CRC held</p>
      ) : (
        <ul className="space-y-2">
          {holdings.map((h) => (
            <li key={h.issuer} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                {h.isGroup && <Sparkle className="size-3 shrink-0 text-amber" />}
                <span className="mono truncate text-xs">
                  {h.name || shortenAddress(h.issuer)}
                </span>
              </span>
              <span className="mono shrink-0 text-xs tabular-nums text-green">
                {formatCrc(h.crc)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const DIR_META: Record<
  Activity['direction'],
  { icon: React.ComponentType<{ className?: string }>; cls: string; sign: string }
> = {
  in: { icon: ArrowDownLeft, cls: 'text-green', sign: '+' },
  out: { icon: ArrowUpRight, cls: 'text-amber', sign: '−' },
  mint: { icon: Sparkle, cls: 'text-blue', sign: '+' },
  self: { icon: Repeat, cls: 'text-muted-foreground', sign: '' },
};

/** Real on-chain transfer history for the active avatar. */
export function ActivityPanel() {
  const { activity } = useSession();
  return (
    <div className="panel p-4">
      <PanelHead icon={ActivityIcon} title="activity" />
      {activity.length === 0 ? (
        <p className="mono py-2 text-xs text-muted-foreground">no transfers yet</p>
      ) : (
        <ul className="space-y-2">
          {activity.map((a) => {
            const meta = DIR_META[a.direction];
            const Icon = meta.icon;
            const other = a.direction === 'in' ? a.from : a.to;
            return (
              <li key={a.hash} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Icon className={`size-3.5 shrink-0 ${meta.cls}`} />
                  {a.direction === 'mint' ? (
                    <span className="mono truncate text-xs text-muted-foreground">
                      minted UBI
                    </span>
                  ) : (
                    <ProfileChip address={other} variant="sm" hideAddress />
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`mono text-xs tabular-nums ${meta.cls}`}>
                    {meta.sign}
                    {formatCrc(a.crc)}
                  </span>
                  <a
                    href={`https://gnosisscan.io/tx/${a.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mono text-[10px] text-muted-foreground hover:text-foreground"
                    title={formatRelative(a.timestamp)}
                  >
                    {formatRelative(a.timestamp)}
                  </a>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
