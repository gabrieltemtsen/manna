'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type RequestCreateAccount = () => Promise<{
  authenticated: boolean;
  address: string;
}>;

type WalletContextValue = {
  /** Lowercased hex address pushed by the Circles host, or null. */
  address: `0x${string}` | null;
  isConnected: boolean;
  isMiniappHost: boolean;
  connecting: boolean;
  connectError: string | null;
  /**
   * Open the host's account create/connect flow. Must be called directly from
   * a user gesture (it triggers a WebAuthn passkey prompt). No-op outside the
   * host.
   */
  connect: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue>({
  address: null,
  isConnected: false,
  isMiniappHost: false,
  connecting: false,
  connectError: null,
  connect: async () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [isMiniappHost, setIsMiniappHost] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Preload the host function so the click handler stays a clean user gesture
  // (no dynamic-import await between the click and requestCreateAccount).
  const requestRef = useRef<RequestCreateAccount | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    // The SDK touches `window`/`parent`, so it must be dynamically imported
    // inside an effect rather than loaded at module top-level.
    import('@aboutcircles/miniapp-sdk')
      .then(({ onWalletChange, isMiniappMode, requestCreateAccount }) => {
        if (cancelled) return;
        setIsMiniappHost(isMiniappMode());
        requestRef.current = requestCreateAccount as RequestCreateAccount;
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

  async function connect() {
    setConnectError(null);
    const req = requestRef.current;
    if (!req) {
      setConnectError('Open this app inside the Circles host to connect.');
      return;
    }
    setConnecting(true);
    try {
      const { address: addr } = await req();
      if (addr) setAddress(addr.toLowerCase() as `0x${string}`);
    } catch (err) {
      setConnectError(
        err instanceof Error ? err.message : 'Connection cancelled.'
      );
    } finally {
      setConnecting(false);
    }
  }

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected: !!address,
        isMiniappHost,
        connecting,
        connectError,
        connect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
