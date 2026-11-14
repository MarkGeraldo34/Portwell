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

// Learner side of the same site reputation, also derived only from on-chain subscriptions:
//   score = 100 - 60 x dispute rate - 20 x early-cancel rate   (rates are per subscription the person made)
// A learner who never subscribed is "New". Cancelling is allowed, so it costs less than opening disputes.
export interface LearnerActivity {
  subscriptions: number;
  disputes: number;
  cancels: number;
}

export function learnerReputation({ subscriptions, disputes, cancels }: LearnerActivity): Score {
  if (subscriptions <= 0) return { kind: "new" };
  const rate = (n: number) => Math.min(1, Math.max(0, n) / subscriptions);
  const value = Math.round(100 - 60 * rate(disputes) - 20 * rate(cancels));
  return { kind: "scored", value: Math.max(0, Math.min(100, value)) };
}

/** Count a learner's activity from their subscriptions (status strings come from the contract). */
export function learnerActivity(subs: { learner: string; status: string; total: string; released: string }[], account: string): LearnerActivity {
  const mine = subs.filter((s) => s.learner === account);
  return {
    subscriptions: mine.length,
    disputes: mine.filter((s) => s.status === "Disputed" || s.status === "Resolved").length,
    cancels: mine.filter((s) => s.status === "Cancelled" && BigInt(s.released) < BigInt(s.total)).length,
  };
}
