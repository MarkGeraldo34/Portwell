import { test } from "node:test";
import assert from "node:assert/strict";
import { KeyPair } from "@near-js/crypto";
import { payloadHash, verifySignedMessage } from "./nep413.ts";

const nonce = new Uint8Array(32).fill(7);

function sign(message: string, recipient = "portwell") {
  const kp = KeyPair.fromRandom("ed25519");
  const { signature } = kp.sign(payloadHash(message, nonce, recipient));
  return { kp, signature: Buffer.from(signature).toString("base64") };
}

test("valid signature verifies", () => {
  const { kp, signature } = sign("hello");
  assert.equal(
    verifySignedMessage({ message: "hello", nonce, recipient: "portwell", publicKey: kp.getPublicKey().toString(), signature }),
    true,
  );
});

test("tampered message, recipient or nonce fail", () => {
  const { kp, signature } = sign("hello");
  const pk = kp.getPublicKey().toString();
  assert.equal(verifySignedMessage({ message: "hellp", nonce, recipient: "portwell", publicKey: pk, signature }), false);
  assert.equal(verifySignedMessage({ message: "hello", nonce, recipient: "other", publicKey: pk, signature }), false);
  assert.equal(
    verifySignedMessage({ message: "hello", nonce: new Uint8Array(32).fill(8), recipient: "portwell", publicKey: pk, signature }),
    false,
  );
});

test("a different key cannot verify", () => {
  const { signature } = sign("hello");
  const other = KeyPair.fromRandom("ed25519").getPublicKey().toString();
  assert.equal(verifySignedMessage({ message: "hello", nonce, recipient: "portwell", publicKey: other, signature }), false);
});

test("garbage input returns false instead of throwing", () => {
  assert.equal(verifySignedMessage({ message: "x", nonce, recipient: "portwell", publicKey: "nope", signature: "!!" }), false);
});
