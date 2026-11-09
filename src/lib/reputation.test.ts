import { test } from "node:test";
import assert from "node:assert/strict";
import { reputation } from "./reputation.ts";

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
