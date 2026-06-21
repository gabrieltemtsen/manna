'use client';

import { ExternalLink, Loader2, Wallet } from 'lucide-react';
import { useWallet } from '@/hooks/use-wallet';
import { AddressLookup } from '@/components/manna/AddressLookup';
import { Tooltip } from '@/components/ui/tooltip';
import { playgroundUrl } from '@/lib/host';

/**
 * Shown whenever we can't sign/send (no connected wallet). It gives the user
 * the right action for their context:
 *   · inside the Circles host → a real "Connect wallet" button (passkey flow)
 *   · standalone → a one-click link to open Manna in the Circles playground,
 *     where they can connect, plus a read-only address lookup to explore live.
 */
export function ConnectPanel() {
  const { isMiniappHost, connect, connecting, connectError } = useWallet();

  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="mono text-xs text-muted-foreground">
            <span className="text-green">$</span> connect to give —{' '}
            <span className="text-foreground">read-only without a wallet</span>
          </span>
          <Tooltip
            side="bottom"
            content="Manna is an AI agent for Circles. It reads your real trust graph and routes your decaying CRC (basic income that loses ~7%/yr) to people you choose — with a reason and a traced path for each gift. Connect to send; or load any address to explore live."
          >
            <span className="mono inline-flex size-4 cursor-help items-center justify-center rounded-full bg-secondary text-[10px] text-muted-foreground hover:text-foreground">
              ?
            </span>
          </Tooltip>
        </div>

        {isMiniappHost ? (
          <button
            onClick={connect}
            disabled={connecting}
            className="mono inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {connecting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Wallet className="size-3.5" />
            )}
            {connecting ? 'connecting…' : 'connect Circles wallet'}
          </button>
        ) : (
          <a
            href={playgroundUrl()}
            target="_blank"
            rel="noreferrer"
            className="mono inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            title="Opens Manna inside the Circles host so you can connect your wallet"
          >
            <ExternalLink className="size-3.5" />
            open in Circles playground
          </a>
        )}
      </div>

      {connectError && (
        <p className="mono mt-2 text-[11px] text-red">{connectError}</p>
      )}

      <div className="mt-4 border-t border-border pt-4">
        <AddressLookup />
      </div>
    </div>
  );
}
