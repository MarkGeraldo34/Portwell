import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSet, offerKey, parseOffer, parseRequest, validateOffer, validateRequest, ACTION } from "./social-format.ts";

test("valid request is trimmed and stamped", () => {
  const r = validateRequest({ title: "  Learn   staking ", details: "Beginner here", budget: "1.5" }, 123);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.value, { v: 1, t: "Learn staking", d: "Beginner here", b: "1.5", ts: 123 });
});

test("rejects short title, bad or tiny budget, long text", () => {
  assert.equal(validateRequest({ title: "ab", details: "", budget: "1" }).ok, false);
  assert.equal(validateRequest({ title: "Learn staking", details: "", budget: "abc" }).ok, false);
  assert.equal(validateRequest({ title: "Learn staking", details: "", budget: "0.01" }).ok, false);
  assert.equal(validateRequest({ title: "Learn staking", details: "x".repeat(301), budget: "1" }).ok, false);
  assert.equal(validateRequest({ title: "Learn staking", details: "", budget: "1e3" }).ok, false);
});

test("buildSet nests a JSON string under the signer's index and asks for a refund of unused deposit", () => {
  const s = buildSet("alice.testnet", "request", { v: 1 });
  const raw = (s.data["alice.testnet"] as { index: Record<string, string> }).index[ACTION];
  assert.deepEqual(JSON.parse(raw), { key: "request", value: { v: 1 } });
  assert.equal(s.options.refund_unused_deposit, true);
});

test("offer key ties an offer to one request", () => {
  assert.equal(offerKey("alice.testnet", 42), "offer/alice.testnet/42");
});

test("parseRequest drops malformed or out-of-range entries and keeps good ones", () => {
  const good = { account_id: "a.testnet", block_height: 5, value: { v: 1, t: "Learn staking", d: "hi", b: "2", ts: 9 } };
  assert.equal(parseRequest(good)?.budget, 2);
  assert.equal(parseRequest({ ...good, value: { t: "x", b: "2" } }), null);
  assert.equal(parseRequest({ ...good, value: { ...good.value, b: "-5" } }), null);
  assert.equal(parseRequest({ account_id: 5, block_height: 1, value: {} }), null);
});

test("parseOffer tolerates an empty note", () => {
  assert.equal(parseOffer({ account_id: "s.testnet", block_height: 7, value: {} })?.note, "");
  assert.equal(validateOffer("x".repeat(141)).ok, false);
});
