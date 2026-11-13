import { test } from "node:test";
import assert from "node:assert/strict";
import { makeToken, readToken, roleOf, validateChatText } from "./chat.ts";

const S = { sharer: "s.testnet", learner: "l.testnet", account: "l.testnet", exp: 2000 };

test("a token reads back until it expires", () => {
  const t = makeToken("k", S);
  assert.deepEqual(readToken("k", t, 1000), S);
  assert.equal(readToken("k", t, 2001), null);
  assert.equal(roleOf(S), "learner");
  assert.equal(roleOf({ ...S, account: "s.testnet" }), "sharer");
});

test("a forged, edited or wrong-key token is refused", () => {
  const t = makeToken("k", S);
  assert.equal(readToken("other", t, 1000), null);
  const [body, sig] = t.split(".");
  const evil = Buffer.from(JSON.stringify({ ...S, account: "s.testnet" })).toString("base64url");
  assert.equal(readToken("k", `${evil}.${sig}`, 1000), null);
  assert.equal(readToken("k", `${body}.x`, 1000), null);
  assert.equal(readToken("k", "garbage", 1000), null);
  assert.equal(readToken("k", makeToken("k", { ...S, account: "eve.testnet" }), 1000), null); // not a participant
});

test("messages must be non-empty and short", () => {
  assert.equal(validateChatText("   ").ok, false);
  assert.equal(validateChatText("x".repeat(501)).ok, false);
  assert.deepEqual(validateChatText("  hello  "), { ok: true, value: "hello" });
});
