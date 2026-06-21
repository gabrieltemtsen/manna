/**
 * Circles host helpers.
 *
 * The Circles "playground" embeds a mini app inside the real host iframe, where
 * users get the full passkey + Safe wallet experience. We link to it so people
 * can open Manna in the host and connect with one click.
 *
 * Docs: https://docs.aboutcircles.com/miniapps/create-or-connect-a-circles-account-from-a-mini-app
 *   → https://circles.gnosis.io/playground?url=<your-app-url>
 */

export const CIRCLES_PLAYGROUND = 'https://circles.gnosis.io/playground';

/** The public URL the playground should embed (this app's origin). */
export function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
}

/** Full playground link that opens this app embedded in the Circles host. */
export function playgroundUrl(url: string = appUrl()): string {
  return `${CIRCLES_PLAYGROUND}?url=${encodeURIComponent(url)}`;
}
