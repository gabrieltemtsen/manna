'use client';

import { useEffect, useState } from 'react';
import { Loader2, Wallet } from 'lucide-react';
import { useSession } from '@/components/session/SessionProvider';
import { useWallet } from '@/hooks/use-wallet';
import { ANNUAL_DEMURRAGE } from '@/lib/demurrage';
import { shortenAddress } from '@/lib/format';

/** Compact live status: connection, active avatar, balance, decay rate. */
export function StatusBar() {
  const { address, source, snapshot, loading } = useSession();
  const { isMiniappHost, connect, connecting } = useWallet();
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const connected = source === 'wallet';
  const bal = snapshot?.totalCrc ?? null;
  const perSecond = bal ? (bal * ANNUAL_DEMURRAGE) / (365.25 * 86_400) : 0;

  return (
    <div className="flex items-center gap-2.5 mono text-xs">
      {bal !== null && (
        <span className="hidden items-center gap-1.5 sm:flex">
          <span className="tabular-nums text-foreground">{bal.toFixed(2)}</span>
          <span className="text-muted-foreground">CRC</span>
          <span className="text-amber tabular-nums" title="decaying per second">
            −{perSecond.toFixed(7)}/s
          </span>
        </span>
      )}

      {isMiniappHost && !connected && (
        <button
          onClick={connect}
          disabled={connecting}
          className="mono inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
        >
          {connecting ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Wallet className="size-3" />
          )}
          connect
        </button>
      )}

      <span
        className={`flex items-center gap-1.5 rounded-full px-2 py-1 ${
          connected ? 'bg-green-soft text-green' : 'bg-secondary text-muted-foreground'
        }`}
        title={
          connected
            ? 'Connected Circles wallet — can sign & send'
            : address
              ? 'Read-only lookup — open in the Circles app to send'
              : 'Not connected'
        }
      >
        <span
          className={`size-1.5 rounded-full ${
            connected ? 'bg-green-500 live-dot' : 'bg-muted-foreground/60'
          }`}
          style={connected ? { background: 'var(--green)' } : undefined}
        />
        {loading
          ? 'syncing…'
          : address
            ? shortenAddress(address)
            : 'offline'}
      </span>
    </div>
  );
}
