import { test } from "node:test";
import assert from "node:assert/strict";
import { postLocked, postTsFromId, requestLocked } from "./delete-rules.ts";

const sub = (learner: string, sharer: string, startMs = 5000) => ({ learner, sharer, start_ns: String(BigInt(startMs) * 1_000_000n) });

test("any subscription to the sharer locks a post, whatever its status", () => {
  assert.equal(postLocked([sub("l.testnet", "s.testnet")], "s.testnet"), true);
  assert.equal(postLocked([sub("l.testnet", "other.testnet")], "s.testnet"), false);
  assert.equal(postLocked([], "s.testnet"), false);
});

test("a subscription that started before the post was published does not lock it", () => {
  assert.equal(postLocked([sub("l.testnet", "s.testnet", 1_000_000)], "s.testnet", 5_000_000), false);
  assert.equal(postLocked([sub("l.testnet", "s.testnet", 6_000_000)], "s.testnet", 5_000_000), true);
});

test("post time comes from the id", () => {
  assert.equal(postTsFromId("1700000000000-abc123"), 1700000000000);
  assert.equal(postTsFromId("nonsense"), undefined);
});

test("a request is locked only by a subscription to a sharer who offered on it", () => {
  assert.equal(requestLocked([sub("l.testnet", "s.testnet")], "l.testnet", ["s.testnet"]), true);
  assert.equal(requestLocked([sub("l.testnet", "x.testnet")], "l.testnet", ["s.testnet"]), false);
  assert.equal(requestLocked([sub("m.testnet", "s.testnet")], "l.testnet", ["s.testnet"]), false);
  assert.equal(requestLocked([sub("l.testnet", "s.testnet", 1_000)], "l.testnet", ["s.testnet"], 9_000_000), false);
});
