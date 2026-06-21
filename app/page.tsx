'use client';

import { useState } from 'react';
import { useSession } from '@/components/session/SessionProvider';
import { AgentConsole } from '@/components/manna/AgentConsole';
import { AddressLookup } from '@/components/manna/AddressLookup';
import { GraphPanel, HoldingsPanel, ActivityPanel } from '@/components/manna/SidePanels';

export default function Page() {
  const { address, canSend } = useSession();
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());

  return (
    <div className="space-y-4">
      {/* tagline */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-medium tracking-tight">
            Manna — <span className="text-green">live</span> generosity agent
          </h1>
          <p className="mono mt-0.5 text-xs text-muted-foreground">
            real Circles trust graph · decaying UBI · agent-routed gifts with traced paths
          </p>
        </div>
      </div>

      {/* read-only / connect strip */}
      {!canSend && <AddressLookup />}

      {/* main grid */}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <AgentConsole onHighlight={setHighlighted} />

        <div className="space-y-4">
          {address ? (
            <>
              <GraphPanel highlighted={highlighted} />
              <HoldingsPanel />
              <ActivityPanel />
            </>
          ) : (
            <div className="panel p-6 text-center">
              <p className="mono text-xs text-muted-foreground">
                load an avatar to see its live trust graph, holdings & activity
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
