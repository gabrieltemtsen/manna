/**
 * Circles demurrage math.
 *
 * Circles is a *demurrage* currency: every personal CRC token continuously
 * loses value at a fixed rate so that holding is discouraged and circulation
 * is rewarded. This is the protocol's signature economic primitive, and it's
 * what gives a blessing its urgency — a chain that sits doesn't just break
 * socially, the CRC inside it literally shrinks.
 *
 * The Circles v2 contracts apply demurrage on a *daily* cadence using a fixed
 * per-day retention factor `GAMMA`. One year of demurrage compounds to a ~7%
 * loss of value:
 *
 *     GAMMA ** 365.25  ≈ 0.93   (i.e. −7% / year)
 *
 * `GAMMA` below is the constant used by the Circles v2 `Demurrage` contract
 * (the 64.64 fixed-point value 0xfff...  expressed as a JS float). We keep the
 * full precision so our client-side display matches what the Hub reports.
 *
 * Docs: https://docs.aboutcircles.com  →  "Demurrage" / "Circles 101".
 */

/** Per-day value retention factor. `1 - GAMMA` is the daily decay. */
export const GAMMA_PER_DAY = 0.9998013320085989;

/** Nominal annual demurrage, expressed as a positive loss fraction (~0.07). */
export const ANNUAL_DEMURRAGE = 1 - Math.pow(GAMMA_PER_DAY, 365.25);

const MS_PER_DAY = 86_400_000;

/**
 * Value of `amount` CRC after `elapsedMs` of demurrage.
 *
 * Demurrage compounds continuously in spirit but the contract samples it per
 * day; we use the smooth `GAMMA ** days` form so a live countdown decays
 * smoothly on screen rather than stepping once a day.
 */
export function demurrage(amount: number, elapsedMs: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (elapsedMs <= 0) return amount;
  const days = elapsedMs / MS_PER_DAY;
  return amount * Math.pow(GAMMA_PER_DAY, days);
}

/** How much value (in CRC) demurrage has eaten since `sinceMs`. */
export function demurrageLost(
  amount: number,
  sinceMs: number,
  nowMs: number = Date.now()
): number {
  return amount - demurrage(amount, Math.max(0, nowMs - sinceMs));
}

/** Demurraged present value of `amount` minted/received at `sinceMs`. */
export function presentValue(
  amount: number,
  sinceMs: number,
  nowMs: number = Date.now()
): number {
  return demurrage(amount, Math.max(0, nowMs - sinceMs));
}

/**
 * Project the demurraged value forward to a future deadline — used to tell a
 * holder "wait the full 48h and this blessing will be worth X".
 */
export function valueAt(
  amount: number,
  sinceMs: number,
  atMs: number
): number {
  return demurrage(amount, Math.max(0, atMs - sinceMs));
}
