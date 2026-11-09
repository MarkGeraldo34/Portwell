import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRows, isRefund, mostReputable, mostSubscribed, type SubLite } from "./leaderboard.ts";

const T = "400000000000000000000000";
const sub = (sharer: string, status: string, released = "0"): SubLite => ({ sharer, status, total: T, released });

test("refund only when money went back to the learner", () => {
  assert.equal(isRefund(sub("a", "Cancelled", "0")), true);
  assert.equal(isRefund(sub("a", "Cancelled", T)), false);
  assert.equal(isRefund(sub("a", "Resolved", "0")), true);
  assert.equal(isRefund(sub("a", "Resolved", T)), false);
  assert.equal(isRefund(sub("a", "Active", "0")), false);
});

test("rows include known sharers with no activity as New (null score)", () => {
  const rows = buildRows([], {}, ["quiet.testnet"]);
  assert.deepEqual(rows, [{ sharer: "quiet.testnet", subscriptions: 0, disputes: 0, refunds: 0, score: null }]);
});

test("most subscribed ranks by subscription count", () => {
  const rows = buildRows([], { a: { subscriptions: 2, disputes: 0 }, b: { subscriptions: 9, disputes: 3 } }, ["a", "b"]);
  assert.deepEqual(mostSubscribed(rows).map((r) => r.sharer), ["b", "a"]);
});

test("most reputable: one clean subscription does not beat a long good record", () => {
  const rows = buildRows([], { rookie: { subscriptions: 1, disputes: 0 }, pro: { subscriptions: 40, disputes: 1 } }, ["rookie", "pro"]);
  assert.equal(rows.find((r) => r.sharer === "rookie")?.score, 100);
  assert.deepEqual(mostReputable(rows).map((r) => r.sharer), ["pro", "rookie"]);
});

test("sharers with no subscriptions rank last for reputation", () => {
  const rows = buildRows([], { a: { subscriptions: 1, disputes: 1 } }, ["a", "new.testnet"]);
  assert.deepEqual(mostReputable(rows).map((r) => r.sharer), ["a", "new.testnet"]);
});
