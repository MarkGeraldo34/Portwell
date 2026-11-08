// Decides whether a viewer may see a sharer's gated content. All outside facts (access keys, on-chain
// subscriptions, the clock) come in through `Deps`, so the rules can be tested without a network.
import { verifySignedMessage } from "./nep413.ts";

export const RECIPIENT = "portwell";
export const APP = "portwell";
export const MAX_AGE_MS = 60 * 60 * 1000; // a signed proof is accepted for one hour
const MAX_FUTURE_MS = 2 * 60 * 1000;

const ACCOUNT_RE = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
export const isAccountId = (s: unknown): s is string =>
  typeof s === "string" && s.length >= 2 && s.length <= 64 && ACCOUNT_RE.test(s);

export interface UnlockRequest {
  sharer: string;
  accountId: string;
  publicKey: string;
  signature: string; // base64
  message: string; // JSON: {"app":"portwell","sharer":"...","iat":<ms>}
  nonce: string; // base64, 32 bytes
}

export interface Deps {
  /** True if `publicKey` is currently an access key on `accountId`. */
  hasKey(accountId: string, publicKey: string): Promise<boolean>;
  /** True if `accountId` has an Active subscription to `sharer`. */
  hasActiveSubscription(accountId: string, sharer: string): Promise<boolean>;
  now(): number;
}

export type Decision =
  | { ok: true; reason: "subscriber" | "sharer" }
  | { ok: false; status: 400 | 401 | 403; error: string };

const deny = (status: 400 | 401 | 403, error: string): Decision => ({ ok: false, status, error });

export async function authorize(req: UnlockRequest, deps: Deps): Promise<Decision> {
  if (![req.sharer, req.accountId].every(isAccountId)) return deny(400, "Invalid account");
  if (typeof req.message !== "string" || req.message.length > 300) return deny(400, "Invalid message");
  if (typeof req.signature !== "string" || typeof req.publicKey !== "string") return deny(400, "Invalid signature");

  let parsed: { app?: unknown; sharer?: unknown; iat?: unknown };
  try {
    parsed = JSON.parse(req.message);
  } catch {
    return deny(400, "Invalid message");
  }
  if (parsed.app !== APP || parsed.sharer !== req.sharer || typeof parsed.iat !== "number") {
    return deny(400, "Message does not match this request");
  }
  const age = deps.now() - parsed.iat;
  if (age > MAX_AGE_MS || age < -MAX_FUTURE_MS) return deny(401, "Signature expired. Sign again.");

  const nonce = Buffer.from(req.nonce ?? "", "base64");
  if (nonce.length !== 32) return deny(400, "Invalid nonce");

  const valid = verifySignedMessage({
    message: req.message,
    nonce,
    recipient: RECIPIENT,
    publicKey: req.publicKey,
    signature: req.signature,
  });
  if (!valid) return deny(401, "Signature check failed");

  if (!(await deps.hasKey(req.accountId, req.publicKey))) return deny(401, "That key does not belong to this account");

  if (req.accountId === req.sharer) return { ok: true, reason: "sharer" };
  if (await deps.hasActiveSubscription(req.accountId, req.sharer)) return { ok: true, reason: "subscriber" };
  return deny(403, "No active subscription to this sharer");
}
