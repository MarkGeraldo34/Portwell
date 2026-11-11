import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNotifications, type SubForNotes } from "./notifications.ts";

const NEAR = 10n ** 24n;
const fmt = (y: bigint) => String(Number(y / (NEAR / 100n)) / 100);
const sub = (o: Partial<SubForNotes>): SubForNotes => ({
  id: "0", learner: "ann.testnet", sharer: "sam.testnet", total: String(4n * NEAR), released: "0",
  start_ns: String(1_000_000_000n * 1000n), status: "Active", ...o,
});

test("sharer sees new subscriptions; learner sees their own", () => {
  const subs = [sub({})];
  assert.equal(buildNotifications("sam.testnet", subs, [], false, fmt)[0].title, "ann.testnet subscribed to you");
  assert.equal(buildNotifications("ann.testnet", subs, [], false, fmt)[0].title, "You subscribed to sam.testnet");
  assert.equal(buildNotifications("zed.testnet", subs, [], false, fmt).length, 0);
});

test("refund shows only unreleased amount; disputes show for the sharer", () => {
  const subs = [
    sub({ id: "1", status: "Cancelled", released: String(NEAR) }),
    sub({ id: "2", status: "Disputed" }),
  ];
  const n = buildNotifications("ann.testnet", subs, [], false, fmt);
  assert.ok(n.some((x) => x.kind === "refund" && x.title === "You were refunded 3 NEAR"));
  const s = buildNotifications("sam.testnet", subs, [], false, fmt);
  assert.ok(s.some((x) => x.kind === "dispute" && x.title === "ann.testnet opened a dispute against you"));
});

test("owner also sees other people's disputes and refunds, but not their subscriptions", () => {
  const subs = [sub({ id: "3", status: "Disputed" }), sub({ id: "4", status: "Cancelled", released: "0" })];
  const n = buildNotifications("0xb.testnet", subs, [], true, fmt);
  assert.ok(n.some((x) => x.kind === "dispute" && x.detail.includes("Needs your decision")));
  assert.ok(n.some((x) => x.kind === "refund"));
  assert.equal(n.filter((x) => x.kind === "subscription").length, 0);
});

test("offers appear only for requests I posted", () => {
  const board = [
    { request: { id: "1", title: "Learn staking", learner: "ann.testnet" }, offers: [{ sharer: "sam.testnet", note: "hi", ts: 5 }] },
    { request: { id: "2", title: "Other", learner: "bob.testnet" }, offers: [{ sharer: "sam.testnet", note: "", ts: 6 }] },
  ];
  const n = buildNotifications("ann.testnet", [], board, false, fmt);
  assert.equal(n.length, 1);
  assert.equal(n[0].title, "sam.testnet offered to teach you");
  assert.equal(buildNotifications("sam.testnet", [], board, false, fmt).length, 0);
});
