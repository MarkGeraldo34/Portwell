// When posts and requests may not be deleted: once someone has subscribed. Money may be in escrow, and even a
// finished or cancelled subscription means the post was bought, so the delete button disappears for good.
import type { SubscriptionView } from "./contract.ts";

type Sub = Pick<SubscriptionView, "learner" | "sharer"> & { start_ns?: string };

const SLACK_MS = 60_000; // clocks differ a little between wallet, chain and storage
const startMs = (s: Sub) => (s.start_ns ? Number(BigInt(s.start_ns) / 1_000_000n) : Infinity);

/** A post's creation time (ms) is the first part of its id, "<ts>-<random>". */
export const postTsFromId = (id: string): number | undefined => {
  const n = Number(id.split("-")[0]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * A sharer's post is locked once anyone has subscribed to that sharer after the post was published. The contract has
 * no post id, so a subscription that started before the post cannot have been for it. Without `postTs`, any subscription locks.
 */
export const postLocked = (subs: Sub[], sharer: string, postTs?: number): boolean =>
  subs.some((s) => s.sharer === sharer && (postTs === undefined || startMs(s) >= postTs - SLACK_MS));

/** A learner's request is locked once they subscribed to a sharer who offered on it (after the request was made). */
export const requestLocked = (subs: Sub[], learner: string, offerSharers: string[], requestTs?: number): boolean =>
  subs.some((s) => s.learner === learner && offerSharers.includes(s.sharer) && (requestTs === undefined || startMs(s) >= requestTs - SLACK_MS));
