// Proves that a request comes from the owner of a NEAR account, using a NEP-413 signed message.
// Used for publishing posts and for uploading media. All outside facts come in through Deps, so it is testable.
import { verifySignedMessage } from "./nep413.ts";
import { isAccountId } from "./unlock.ts";
import { APP, RECIPIENT, proofMessage, type ProofKind } from "./proof-message.ts";

export { proofMessage, type ProofKind };

export const PROOF_MAX_AGE_MS = 10 * 60 * 1000;
const MAX_FUTURE_MS = 2 * 60 * 1000;

export interface Proof {
  accountId: string;
  publicKey: string;
  signature: string; // base64
  message: string; // JSON: {"app","action","account","hash"?,"iat"}
  nonce: string; // base64, 32 bytes
}

export interface ProofDeps {
  hasKey(accountId: string, publicKey: string): Promise<boolean>;
  now(): number;
}

export type ProofResult = { ok: true; accountId: string } | { ok: false; status: 400 | 401; error: string };
const deny = (status: 400 | 401, error: string): ProofResult => ({ ok: false, status, error });

export async function verifyProof(proof: Proof, kind: ProofKind, deps: ProofDeps, expectHash?: string): Promise<ProofResult> {
  if (!isAccountId(proof?.accountId)) return deny(400, "Invalid account");
  if (typeof proof.message !== "string" || proof.message.length > 400) return deny(400, "Invalid message");
  if (typeof proof.signature !== "string" || typeof proof.publicKey !== "string") return deny(400, "Invalid signature");

  let m: { app?: unknown; action?: unknown; account?: unknown; hash?: unknown; iat?: unknown };
  try {
    m = JSON.parse(proof.message);
  } catch {
    return deny(400, "Invalid message");
  }
  if (m.app !== APP || m.action !== kind || m.account !== proof.accountId || typeof m.iat !== "number") {
    return deny(400, "Message does not match this request");
  }
  // publish binds to the post contents; delete binds to the id of the post being deleted
  if ((kind === "publish" || kind === "delete" || kind === "update" || kind === "chat") && (typeof m.hash !== "string" || m.hash !== expectHash)) {
    return deny(400, "The signed content does not match the post");
  }
  const age = deps.now() - m.iat;
  if (age > PROOF_MAX_AGE_MS || age < -MAX_FUTURE_MS) return deny(401, "Signature expired. Sign again.");

  const nonce = Buffer.from(proof.nonce ?? "", "base64");
  if (nonce.length !== 32) return deny(400, "Invalid nonce");

  const valid = verifySignedMessage({ message: proof.message, nonce, recipient: RECIPIENT, publicKey: proof.publicKey, signature: proof.signature });
  if (!valid) return deny(401, "Signature check failed");
  if (!(await deps.hasKey(proof.accountId, proof.publicKey))) return deny(401, "That key does not belong to this account");
  return { ok: true, accountId: proof.accountId };
}
