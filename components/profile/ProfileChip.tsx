'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { shortenAddress } from '@/lib/format';
import { cn } from '@/lib/utils';

type Hex = `0x${string}`;
type Variant = 'sm' | 'md' | 'lg';

interface Profile {
  name?: string;
  imageUrl?: string;
}

// Module-level cache so we don't re-fetch the same avatar on every render.
const cache = new Map<string, Profile>();
const inflight = new Map<string, Promise<Profile>>();

async function loadProfile(address: Hex): Promise<Profile> {
  const key = address.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;

  const p = (async () => {
    try {
      const { Sdk } = await import('@aboutcircles/sdk');
      const sdk = new Sdk();
      const view = await sdk.rpc.profile.getProfileView(address);
      if (!view?.avatarInfo) {
        const empty: Profile = {};
        cache.set(key, empty);
        return empty;
      }
      let name = view.profile?.name ?? undefined;
      let imageUrl: string | undefined;
      if (view.avatarInfo.cidV0) {
        try {
          const full = (await sdk.rpc.profile.getProfileByCid(
            view.avatarInfo.cidV0
          )) as { name?: string; imageUrl?: string; previewImageUrl?: string } | null;
          if (full) {
            name = full.name ?? name;
            imageUrl = full.previewImageUrl ?? full.imageUrl;
          }
        } catch {
          /* IPFS may not resolve; fall through */
        }
      }
      const result: Profile = { name, imageUrl };
      cache.set(key, result);
      return result;
    } catch {
      const empty: Profile = {};
      cache.set(key, empty);
      return empty;
    }
  })();

  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}

const SIZES: Record<Variant, { box: string; img: string; name: string; addr: string }> = {
  sm: { box: 'gap-2', img: 'size-6', name: 'text-xs font-medium', addr: 'text-[10px]' },
  md: { box: 'gap-2.5', img: 'size-9', name: 'text-sm font-medium', addr: 'text-xs' },
  lg: { box: 'gap-3', img: 'size-12', name: 'text-base font-semibold', addr: 'text-xs' },
};

export function ProfileChip({
  address,
  variant = 'md',
  hideAddress = false,
  className,
}: {
  address: Hex;
  variant?: Variant;
  hideAddress?: boolean;
  className?: string;
}) {
  const [profile, setProfile] = useState<Profile | null>(
    cache.get(address.toLowerCase()) ?? null
  );

  useEffect(() => {
    let cancelled = false;
    loadProfile(address).then((p) => !cancelled && setProfile(p));
    return () => {
      cancelled = true;
    };
  }, [address]);

  const sizes = SIZES[variant];
  const name = profile?.name?.trim() || shortenAddress(address);
  const showLoading = !profile;
  const initial = (profile?.name?.slice(0, 1) || address.slice(2, 3)).toUpperCase();

  return (
    <div className={cn('flex items-center', sizes.box, className)}>
      {showLoading ? (
        <Skeleton className={cn('rounded-full', sizes.img)} />
      ) : profile.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.imageUrl}
          alt={name}
          className={cn(
            'rounded-full border border-border object-cover',
            sizes.img
          )}
        />
      ) : (
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-gradient-to-br from-amber-200 via-rose-200 to-violet-200 font-semibold text-foreground/80',
            sizes.img
          )}
        >
          {initial}
        </div>
      )}
      <div className="flex min-w-0 flex-col leading-tight">
        <span className={cn('truncate text-foreground', sizes.name)}>{name}</span>
        {!hideAddress && (
          <span className={cn('font-mono text-muted-foreground', sizes.addr)}>
            {shortenAddress(address)}
          </span>
        )}
      </div>
    </div>
  );
}
