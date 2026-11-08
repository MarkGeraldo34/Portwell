// NEP-413 signed-message verification (https://github.com/near/NEPs/blob/master/neps/nep-0413.md).
// Pure and dependency-light so it can be unit tested under `node --test`.
import { createHash } from "node:crypto";
import { serialize } from "borsh";
import { PublicKey } from "@near-js/crypto";

const TAG = 2147484061; // 2^31 + 413

const SCHEMA = {
  struct: {
    message: "string",
    nonce: { array: { type: "u8", len: 32 } },
    recipient: "string",
    callbackUrl: { option: "string" },
  },
} as const;

/** The 32-byte digest a wallet signs for a NEP-413 message (no callback URL). */
export function payloadHash(message: string, nonce: Uint8Array, recipient: string): Uint8Array {
  if (nonce.length !== 32) throw new Error("nonce must be 32 bytes");
  const tag = Buffer.alloc(4);
  tag.writeUInt32LE(TAG);
  const body = serialize(SCHEMA, { message, nonce: Array.from(nonce), recipient, callbackUrl: null });
  return createHash("sha256").update(Buffer.concat([tag, Buffer.from(body)])).digest();
}

export interface SignedMessageInput {
  message: string;
  nonce: Uint8Array;
  recipient: string;
  publicKey: string; // "ed25519:<base58>"
  signature: string; // base64
}

export function verifySignedMessage(input: SignedMessageInput): boolean {
  try {
    const key = PublicKey.fromString(input.publicKey);
    const hash = payloadHash(input.message, input.nonce, input.recipient);
    return key.verify(hash, Buffer.from(input.signature, "base64"));
  } catch {
    return false;
  }
}
