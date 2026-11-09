import { reputation } from "./reputation.ts";

// Pure ranking logic for the leaderboard (no network), so it can be tested.

export interface SubLite {
  sharer: string;
  status: string;
  total: string;
  released: string;
}
export interface StatLite {
  subscriptions: number;
  disputes: number;
}
export interface Row {
  sharer: string;
  subscriptions: number;
  disputes: number;
  refunds: number;
  /** Raw reputation 0-100, or null when the sharer has no subscriptions yet. */
  score: number | null;
}

/** A refund is money that went back to a learner: a cancel or a dispute resolved for them with part unreleased. */
export const isRefund = (s: SubLite) =>
  (s.status === "Cancelled" || s.status === "Resolved") && BigInt(s.released) < BigInt(s.total);

export function buildRows(subs: SubLite[], stats: Record<string, StatLite | null>, known: string[]): Row[] {
  const names = new Set<string>([...known, ...subs.map((s) => s.sharer)]);
  return Array.from(names).map((sharer) => {
    const mine = subs.filter((s) => s.sharer === sharer);
    const st = stats[sharer];
    const subscriptions = st?.subscriptions ?? mine.length;
    const disputes = st?.disputes ?? 0;
    const refunds = mine.filter(isRefund).length;
    const rep = reputation({ subscriptions, disputes, refunds });
    return { sharer, subscriptions, disputes, refunds, score: rep.kind === "scored" ? rep.value : null };
  });
}

export const mostSubscribed = (rows: Row[]): Row[] =>
  [...rows].sort((a, b) => b.subscriptions - a.subscriptions || (b.score ?? -1) - (a.score ?? -1) || a.sharer.localeCompare(b.sharer));

/**
 * Most reputable: ranked by a confidence-weighted score, so one clean subscription does not beat a long
 * good record. The weighting adds 3 imaginary subscriptions at 70 points. The raw score is what we display.
 */
const PRIOR_N = 3;
const PRIOR_SCORE = 70;
const weighted = (r: Row) => (r.score === null ? -1 : (r.score * r.subscriptions + PRIOR_SCORE * PRIOR_N) / (r.subscriptions + PRIOR_N));
export const mostReputable = (rows: Row[]): Row[] =>
  [...rows].sort((a, b) => weighted(b) - weighted(a) || b.subscriptions - a.subscriptions || a.sharer.localeCompare(b.sharer));
