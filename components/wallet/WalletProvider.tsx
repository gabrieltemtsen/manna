'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

type WalletContextValue = {
  /** Lowercased hex address pushed by the Circles host, or null. */
  address: `0x${string}` | null;
  isConnected: boolean;
  isMiniappHost: boolean;
};

const WalletContext = createContext<WalletContextValue>({
  address: null,
  isConnected: false,
  isMiniappHost: false,
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [isMiniappHost, setIsMiniappHost] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    // The SDK touches `window`/`parent`, so it must be dynamically imported
    // inside an effect rather than loaded at module top-level.
    import('@aboutcircles/miniapp-sdk')
      .then(({ onWalletChange, isMiniappMode }) => {
        if (cancelled) return;
        setIsMiniappHost(isMiniappMode());
        unsubscribe = onWalletChange((addr) =>
          setAddress((addr as `0x${string}` | null) ?? null)
        );
      })
      .catch((err) => console.error('[miniapp-sdk] failed to load:', err));

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return (
    <WalletContext.Provider
      value={{ address, isConnected: !!address, isMiniappHost }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
