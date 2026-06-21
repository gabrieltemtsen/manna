'use client';

import { useState } from 'react';
import { Search, Zap } from 'lucide-react';
import { useSession } from '@/components/session/SessionProvider';

/** Real Circles avatars (from the SDK docs) so the console has live data instantly. */
const SAMPLES = [
  '0xde374ece6fa50e781e81aac78e811b33d16912c7',
  '0xc3a1428c04c426cdf513c6fc8e09f55ddaf50cd7',
];

/**
 * When there's no connected wallet, let the user load ANY real Circles avatar
 * so every panel fills with live on-chain data. Sending still requires the
 * host wallet — this is read + plan, fully live.
 */
export function AddressLookup() {
  const { lookup } = useSession();
  const [value, setValue] = useState('');
  const valid = /^0x[a-fA-F0-9]{40}$/.test(value.trim());

  return (
    <div className="panel p-5">
      <p className="mono text-xs text-muted-foreground">
        <span className="text-green">$</span> connect a Circles wallet — or load
        any avatar to explore live
      </p>
      <div className="mt-3 flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-input bg-background px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valid) lookup(value.trim());
            }}
            placeholder="0x… a Circles avatar address"
            spellCheck={false}
            className="mono h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        <button
          disabled={!valid}
          onClick={() => lookup(value.trim())}
          className="mono rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
        >
          load
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="mono text-[11px] text-muted-foreground">
          <Zap className="mr-1 inline size-3 text-amber" />
          try live:
        </span>
        {SAMPLES.map((s) => (
          <button
            key={s}
            onClick={() => lookup(s)}
            className="mono rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-primary/50"
          >
            {s.slice(0, 10)}…{s.slice(-4)}
          </button>
        ))}
      </div>
    </div>
  );
}
