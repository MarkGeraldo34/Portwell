import { test } from "node:test";
import assert from "node:assert/strict";
import { KeyPair } from "@near-js/crypto";
import { payloadHash } from "./nep413.ts";
import { RECIPIENT } from "./unlock.ts";
import { proofMessage, verifyProof, type ProofDeps } from "./publish-auth.ts";
import { keyFrom, open, seal } from "./secret-box.ts";

const NOW = 1_800_000_000_000;
const nonce = new Uint8Array(32).fill(7);
const deps = (over: Partial<ProofDeps> = {}): ProofDeps => ({ hasKey: async () => true, now: () => NOW, ...over });

function sign(message: string, account = "sam.testnet") {
  const kp = KeyPair.fromRandom("ed25519");
  const { signature } = kp.sign(payloadHash(message, nonce, RECIPIENT));
  return { accountId: account, publicKey: kp.getPublicKey().toString(), signature: Buffer.from(signature).toString("base64"), message, nonce: Buffer.from(nonce).toString("base64") };
}

test("a valid publish proof is accepted", async () => {
  const p = sign(proofMessage("publish", "sam.testnet", NOW, "abc"));
  assert.deepEqual(await verifyProof(p, "publish", deps(), "abc"), { ok: true, accountId: "sam.testnet" });
});

test("a proof for different content, another action, or another account is rejected", async () => {
  const p = sign(proofMessage("publish", "sam.testnet", NOW, "abc"));
  assert.equal((await verifyProof(p, "publish", deps(), "different")).ok, false);
  assert.equal((await verifyProof(p, "upload", deps())).ok, false);
  const other = { ...p, accountId: "eve.testnet" };
  assert.equal((await verifyProof(other, "publish", deps(), "abc")).ok, false);
});

test("a delete proof is bound to the post id", async () => {
  const p = sign(proofMessage("delete", "sam.testnet", NOW, "123-abc"));
  assert.equal((await verifyProof(p, "delete", deps(), "123-abc")).ok, true);
  assert.equal((await verifyProof(p, "delete", deps(), "999-zzz")).ok, false);
  assert.equal((await verifyProof(p, "publish", deps(), "123-abc")).ok, false);
});

test("expired, tampered and wrong-key proofs are rejected", async () => {
  const old = sign(proofMessage("upload", "sam.testnet", NOW - 11 * 60 * 1000));
  assert.equal((await verifyProof(old, "upload", deps())).ok, false);
  const p = sign(proofMessage("upload", "sam.testnet", NOW));
  assert.equal((await verifyProof({ ...p, signature: Buffer.alloc(64).toString("base64") }, "upload", deps())).ok, false);
  assert.equal((await verifyProof(p, "upload", deps({ hasKey: async () => false }))).ok, false);
  assert.equal((await verifyProof(p, "upload", deps())).ok, true);
});

test("sealed content round-trips and rejects tampering or a different key", () => {
  const key = keyFrom("token-a");
  const sealed = seal(key, '{"steps":["a"]}');
  assert.equal(open(key, sealed), '{"steps":["a"]}');
  assert.equal(open(keyFrom("token-b"), sealed), null);
  const raw = Buffer.from(sealed, "base64");
  raw[raw.length - 1] ^= 1;
  assert.equal(open(key, raw.toString("base64")), null);
});
