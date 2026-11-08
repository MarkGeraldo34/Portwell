import { test } from "node:test";
import assert from "node:assert/strict";
import { KeyPair } from "@near-js/crypto";
import { payloadHash } from "./nep413.ts";
import { authorize, RECIPIENT, type Deps, type UnlockRequest } from "./unlock.ts";

const NOW = 1_800_000_000_000;
const SHARER = "sharer.testnet";
const LEARNER = "learner.testnet";
const nonceBytes = new Uint8Array(32).fill(3);

function makeReq(over: Partial<{ accountId: string; sharer: string; iat: number; msgSharer: string }> = {}) {
  const kp = KeyPair.fromRandom("ed25519");
  const sharer = over.sharer ?? SHARER;
  const message = JSON.stringify({ app: "portwell", sharer: over.msgSharer ?? sharer, iat: over.iat ?? NOW });
  const { signature } = kp.sign(payloadHash(message, nonceBytes, RECIPIENT));
  const req: UnlockRequest = {
    sharer,
    accountId: over.accountId ?? LEARNER,
    publicKey: kp.getPublicKey().toString(),
    signature: Buffer.from(signature).toString("base64"),
    message,
    nonce: Buffer.from(nonceBytes).toString("base64"),
  };
  return req;
}

const deps = (over: Partial<Deps> = {}): Deps => ({
  hasKey: async () => true,
  hasActiveSubscription: async () => true,
  now: () => NOW,
  ...over,
});

test("active subscriber is allowed", async () => {
  assert.deepEqual(await authorize(makeReq(), deps()), { ok: true, reason: "subscriber" });
});

test("the sharer can view their own content", async () => {
  const d = await authorize(makeReq({ accountId: SHARER }), deps({ hasActiveSubscription: async () => false }));
  assert.deepEqual(d, { ok: true, reason: "sharer" });
});

test("no subscription is forbidden", async () => {
  const d = await authorize(makeReq(), deps({ hasActiveSubscription: async () => false }));
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.status, 403);
});

test("a key that is not on the account is rejected", async () => {
  const d = await authorize(makeReq(), deps({ hasKey: async () => false }));
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.status, 401);
});

test("expired proof is rejected", async () => {
  const d = await authorize(makeReq({ iat: NOW - 2 * 60 * 60 * 1000 }), deps());
  assert.equal(d.ok, false);
});

test("proof signed for another sharer cannot be reused", async () => {
  const d = await authorize(makeReq({ msgSharer: "other.testnet" }), deps());
  assert.equal(d.ok, false);
});

test("claiming someone else's account with your own key fails the key check", async () => {
  const d = await authorize(makeReq(), deps({ hasKey: async (acct) => acct !== LEARNER }));
  assert.equal(d.ok, false);
});

test("forged signature is rejected", async () => {
  const req = makeReq();
  req.signature = Buffer.alloc(64, 1).toString("base64");
  const d = await authorize(req, deps());
  assert.equal(d.ok, false);
});

test("bad account ids are rejected", async () => {
  const d = await authorize({ ...makeReq(), accountId: "Not Valid!" }, deps());
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.status, 400);
});
