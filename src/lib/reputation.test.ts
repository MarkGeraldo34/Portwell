import { test } from "node:test";
import assert from "node:assert/strict";
import { reputation, learnerReputation, learnerActivity } from "./reputation.ts";

test("no subscriptions means New, not a perfect score", () => {
  assert.deepEqual(reputation({ subscriptions: 0, disputes: 0, refunds: 0 }), { kind: "new" });
});
test("clean record scores 100", () => {
  assert.deepEqual(reputation({ subscriptions: 10, disputes: 0, refunds: 0 }), { kind: "scored", value: 100 });
});
test("disputes cost more than refunds", () => {
  const d = reputation({ subscriptions: 10, disputes: 1, refunds: 0 });
  const c = reputation({ subscriptions: 10, disputes: 0, refunds: 1 });
  assert.deepEqual(d, { kind: "scored", value: 94 });
  assert.deepEqual(c, { kind: "scored", value: 96 });
});
test("worst case clamps at 0", () => {
  assert.deepEqual(reputation({ subscriptions: 2, disputes: 5, refunds: 5 }), { kind: "scored", value: 0 });
});

test("learner reputation: New, clean, disputes cost more than cancels", () => {
  assert.deepEqual(learnerReputation({ subscriptions: 0, disputes: 0, cancels: 0 }), { kind: "new" });
  assert.deepEqual(learnerReputation({ subscriptions: 10, disputes: 0, cancels: 0 }), { kind: "scored", value: 100 });
  assert.deepEqual(learnerReputation({ subscriptions: 10, disputes: 1, cancels: 0 }), { kind: "scored", value: 94 });
  assert.deepEqual(learnerReputation({ subscriptions: 10, disputes: 0, cancels: 1 }), { kind: "scored", value: 98 });
});
test("learnerActivity counts only the learner's own subscriptions", () => {
  const subs = [
    { learner: "a", status: "Active", total: "4", released: "0" },
    { learner: "a", status: "Disputed", total: "4", released: "0" },
    { learner: "a", status: "Cancelled", total: "4", released: "1" },
    { learner: "a", status: "Cancelled", total: "4", released: "4" },
    { learner: "b", status: "Disputed", total: "4", released: "0" },
  ];
  assert.deepEqual(learnerActivity(subs, "a"), { subscriptions: 4, disputes: 1, cancels: 1 });
});
