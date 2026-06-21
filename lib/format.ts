/** UI formatting helpers. */

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  const head = address.startsWith('0x') ? 2 + chars : chars;
  return `${address.slice(0, head)}…${address.slice(-chars)}`;
}

export function formatCrc(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/** Returns a human countdown like "31h 14m" or "expired". */
export function formatCountdown(deadlineMs: number, nowMs: number = Date.now()): string {
  const diff = deadlineMs - nowMs;
  if (diff <= 0) return 'expired';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 1) return `${h}h ${m}m`;
  const s = Math.floor((diff % 60_000) / 1000);
  return `${m}m ${s}s`;
}

export function formatRelative(ts: number, now: number = Date.now()): string {
  const diff = now - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export function shortId(len = 6): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  }
  return out;
}
