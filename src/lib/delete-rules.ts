// When posts and requests may not be deleted. A subscription that is Active or Disputed still has money in escrow.
import type { SubscriptionView } from "./contract.ts";

const LIVE = new Set(["Active", "Disputed"]);
type Sub = Pick<SubscriptionView, "learner" | "sharer" | "status">;

/** A sharer's posts are locked while anyone has a live subscription to them. */
export const postLocked = (subs: Sub[], sharer: string): boolean => subs.some((s) => s.sharer === sharer && LIVE.has(s.status));

/** A learner's request is locked while they have a live subscription to a sharer who offered on it. */
export const requestLocked = (subs: Sub[], learner: string, offerSharers: string[]): boolean =>
  subs.some((s) => s.learner === learner && offerSharers.includes(s.sharer) && LIVE.has(s.status));
