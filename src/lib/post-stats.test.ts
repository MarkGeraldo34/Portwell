import { test } from "node:test";
import assert from "node:assert/strict";
import { attributeToPosts } from "./post-stats.ts";

const T = "1000000000000000000000000";
const sub = (sharer: string, startMs: number, status = "Active", released = "0") => ({ sharer, status, total: T, released, start_ns: String(BigInt(startMs) * 1_000_000n) });
const posts = [
  { id: "1000-aaa", sharer: "s.testnet" },
  { id: "5000-bbb", sharer: "s.testnet" },
  { id: "2000-ccc", sharer: "other.testnet" },
];

test("each subscription counts for the sharer's newest post at the time it started", () => {
  const r = attributeToPosts([sub("s.testnet", 1500), sub("s.testnet", 6000), sub("s.testnet", 7000)], posts);
  assert.equal(r["1000-aaa"].subscriptions, 1);
  assert.equal(r["5000-bbb"].subscriptions, 2);
  assert.equal(r["2000-ccc"].subscriptions, 0);
});

test("disputes and refunds are counted on the same post only", () => {
  const r = attributeToPosts([sub("s.testnet", 1500, "Disputed"), sub("s.testnet", 6000, "Cancelled", "0"), sub("s.testnet", 6100, "Completed", T)], posts);
  assert.deepEqual(r["1000-aaa"], { subscriptions: 1, disputes: 1, refunds: 0 });
  assert.deepEqual(r["5000-bbb"], { subscriptions: 2, disputes: 0, refunds: 1 });
});

test("a subscription from before the sharer's first post, or to a sharer with no posts, counts nowhere", () => {
  const r = attributeToPosts([sub("s.testnet", 500), sub("nobody.testnet", 9000)], posts);
  assert.equal(r["1000-aaa"].subscriptions, 0);
  assert.equal(Object.values(r).reduce((a, x) => a + x.subscriptions, 0), 0);
});
