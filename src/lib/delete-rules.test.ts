import { test } from "node:test";
import assert from "node:assert/strict";
import { postLocked, requestLocked } from "./delete-rules.ts";

const sub = (learner: string, sharer: string, status: "Active" | "Disputed" | "Completed" | "Cancelled" | "Resolved") => ({ learner, sharer, status });

test("a post with a live subscriber cannot be deleted", () => {
  assert.equal(postLocked([sub("l.testnet", "s.testnet", "Active")], "s.testnet"), true);
  assert.equal(postLocked([sub("l.testnet", "s.testnet", "Disputed")], "s.testnet"), true);
});

test("finished or unrelated subscriptions do not lock a post", () => {
  assert.equal(postLocked([sub("l.testnet", "s.testnet", "Completed"), sub("l.testnet", "s.testnet", "Cancelled"), sub("l.testnet", "s.testnet", "Resolved")], "s.testnet"), false);
  assert.equal(postLocked([sub("l.testnet", "other.testnet", "Active")], "s.testnet"), false);
  assert.equal(postLocked([], "s.testnet"), false);
});

test("a request is locked only by a live subscription to a sharer who offered on it", () => {
  assert.equal(requestLocked([sub("l.testnet", "s.testnet", "Active")], "l.testnet", ["s.testnet"]), true);
  assert.equal(requestLocked([sub("l.testnet", "x.testnet", "Active")], "l.testnet", ["s.testnet"]), false);
  assert.equal(requestLocked([sub("l.testnet", "s.testnet", "Completed")], "l.testnet", ["s.testnet"]), false);
  assert.equal(requestLocked([sub("m.testnet", "s.testnet", "Active")], "l.testnet", ["s.testnet"]), false);
});
