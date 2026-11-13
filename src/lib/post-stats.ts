// Per-post numbers for the feed. The contract keeps subscriptions per sharer, not per post, so each subscription is
// credited to the post that was the sharer's newest when it started (post ids begin with their creation time in ms).
import { isRefund } from "./leaderboard.ts";

export interface PostNumbers {
  subscriptions: number;
  disputes: number;
  refunds: number;
}
interface SubForStats {
  sharer: string;
  status: string;
  total: string;
  released: string;
  start_ns: string;
}

export const postTime = (id: string): number | null => {
  const n = Number(id.split("-")[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function attributeToPosts(subs: SubForStats[], posts: { id: string; sharer: string }[]): Record<string, PostNumbers> {
  const out: Record<string, PostNumbers> = {};
  for (const p of posts) out[p.id] = { subscriptions: 0, disputes: 0, refunds: 0 };
  for (const s of subs) {
    const startMs = Number(BigInt(s.start_ns) / 1_000_000n);
    let best: { id: string; t: number } | null = null;
    for (const p of posts) {
      const t = postTime(p.id);
      if (p.sharer === s.sharer && t !== null && t <= startMs && (!best || t > best.t)) best = { id: p.id, t };
    }
    if (!best) continue;
    const n = out[best.id];
    n.subscriptions += 1;
    if (s.status === "Disputed" || s.status === "Resolved") n.disputes += 1;
    if (isRefund(s)) n.refunds += 1;
  }
  return out;
}
