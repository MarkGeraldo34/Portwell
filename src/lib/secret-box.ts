// Encrypts the gated part of a post before it is stored, so a leaked storage URL reveals only ciphertext.
// AES-256-GCM. The key is derived from a server-side secret (never sent to the browser).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const keyFrom = (secret: string): Buffer => createHash("sha256").update(`portwell-content-v1:${secret}`).digest();

export function seal(key: Buffer, plaintext: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}

export function open(key: Buffer, sealed: string): string | null {
  try {
    const raw = Buffer.from(sealed, "base64");
    if (raw.length < 29) return null;
    const d = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
