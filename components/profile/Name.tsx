'use client';

import { useEffect, useState } from 'react';
import { shortenAddress } from '@/lib/format';
import type { Hex } from '@/lib/types';

/**
 * Resolve an address to its Circles profile name (cached in lib/circles), with
 * a shortened-address fallback. Makes chips and routes read socially instead of
 * as raw hex.
 */
export function useName(address: Hex | string): string {
  const fallback = shortenAddress(address);
  const [name, setName] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getProfileName } = await import('@/lib/circles');
        const n = await getProfileName(address as `0x${string}`);
        if (!cancelled) setName(n);
      } catch {
        /* keep fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  return name || fallback;
}

export function Name({
  address,
  className,
}: {
  address: Hex | string;
  className?: string;
}) {
  const name = useName(address);
  return <span className={className}>{name}</span>;
}
