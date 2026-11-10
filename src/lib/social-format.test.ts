import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOfferSet, buildRequestSet, offerId, parseOffers, parseRequests, validateOffer, validateRequest } from "./social-format.ts";

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

test("a request is written only under the signer's own account, as JSON text, with unused deposit refunded", () => {
  const v = { v: 1 as const, t: "Learn staking", d: "", b: "1", ts: 5 };
  const s = buildRequestSet("alice.testnet", "1700000000000", v);
  assert.deepEqual(Object.keys(s.data), ["alice.testnet"]);
  const text = (s.data["alice.testnet"] as { portwell: { request: Record<string, string> } }).portwell.request["1700000000000"];
  assert.deepEqual(JSON.parse(text), v);
  assert.equal(s.options.refund_unused_deposit, true);
});

test("an offer is keyed by learner and request id, under the sharer's own account", () => {
  const s = buildOfferSet("sam.testnet", "alice.testnet", "17", { v: 1, n: "hi", ts: 1 });
  assert.deepEqual(Object.keys(s.data), ["sam.testnet"]);
  const offers = (s.data["sam.testnet"] as { portwell: { offer: Record<string, string> } }).portwell.offer;
  assert.deepEqual(Object.keys(offers), [offerId("alice.testnet", "17")]);
});

const tree = {
  "a.testnet": { portwell: { request: {
    "200": JSON.stringify({ v: 1, t: "Learn staking", d: "hi", b: "2", ts: 200 }),
    "100": "not json",
    "300": JSON.stringify({ t: "x", b: "2" }),
    "400": JSON.stringify({ v: 1, t: "Learn airdrops", d: "", b: "-5", ts: 400 }),
  } } },
  "b.testnet": { portwell: { request: { "250": JSON.stringify({ v: 1, t: "How do airdrops work", d: "", b: "0.5", ts: 250 }) } } },
  "c.testnet": { other: {} },
};

test("parseRequests drops malformed or out-of-range entries and sorts newest first", () => {
  const r = parseRequests(tree);
  assert.deepEqual(r.map((x) => `${x.learner}/${x.id}`), ["b.testnet/250", "a.testnet/200"]);
  assert.equal(parseRequests(null).length, 0);
  assert.equal(parseRequests([]).length, 0);
});

test("parseOffers returns only offers for the given request", () => {
  const offers = {
    "s1.testnet": { portwell: { offer: { "a.testnet_200": JSON.stringify({ v: 1, n: "me", ts: 2 }), "a.testnet_999": JSON.stringify({ v: 1, n: "other", ts: 3 }) } } },
    "s2.testnet": { portwell: { offer: { "a.testnet_200": JSON.stringify({ v: 1, ts: 1 }) } } },
  };
  const o = parseOffers(offers, "a.testnet", "200");
  assert.deepEqual(o.map((x) => x.sharer), ["s2.testnet", "s1.testnet"]);
  assert.equal(o[0].note, "");
});

test("offer note limit", () => {
  assert.equal(validateOffer("x".repeat(141)).ok, false);
});
