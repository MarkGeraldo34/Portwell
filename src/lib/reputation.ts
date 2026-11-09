// Reputation shown on the feed. Derived only from on-chain activity, so anyone can recompute it:
//   score = 100 - 60 x dispute rate - 40 x refund rate   (rates are per subscription)
// A sharer with no subscriptions yet has no score ("New"), not a perfect one.

export interface Activity {
  subscriptions: number;
  disputes: number;
  refunds: number;
}

export type Score = { kind: "new" } | { kind: "scored"; value: number };

export function reputation({ subscriptions, disputes, refunds }: Activity): Score {
  if (subscriptions <= 0) return { kind: "new" };
  const rate = (n: number) => Math.min(1, Math.max(0, n) / subscriptions);
  const value = Math.round(100 - 60 * rate(disputes) - 40 * rate(refunds));
  return { kind: "scored", value: Math.max(0, Math.min(100, value)) };
}
