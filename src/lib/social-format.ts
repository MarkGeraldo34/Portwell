// Pure helpers for learner requests and sharer offers stored on NEAR Social DB (no network, easy to test).
// Social DB keeps an "index": each account can append entries under an action. We use action "portwell":
//   key "request"                      -> a learner asks for a guide
//   key "offer/<learner>/<blockHeight>" -> a sharer offers to teach that request

export const ACTION = "portwell";
export const REQUEST_KEY = "request";
export const offerKey = (learner: string, blockHeight: number | string) => `offer/${learner}/${blockHeight}`;

export const LIMITS = { title: 80, details: 300, note: 140, minBudget: 0.1, maxBudget: 100_000 };

export interface RequestValue {
  v: 1;
  t: string; // what the learner wants to learn
  d: string; // details
  b: string; // budget in NEAR, as a plain decimal string
  ts: number; // client time, display only
}
export interface OfferValue {
  v: 1;
  n: string; // optional note
  ts: number;
}
export interface RequestPost {
  learner: string;
  blockHeight: number;
  title: string;
  details: string;
  budget: number;
  ts: number;
}
export interface OfferPost {
  sharer: string;
  blockHeight: number;
  note: string;
  ts: number;
}
export interface RawEntry {
  account_id?: unknown;
  block_height?: unknown;
  value?: unknown;
}

type Valid<T> = { ok: true; value: T } | { ok: false; error: string };

const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

export function validateRequest(input: { title: string; details: string; budget: string }, now = Date.now()): Valid<RequestValue> {
  const t = clean(input.title);
  const d = clean(input.details);
  const budget = Number(input.budget);
  if (t.length < 5) return { ok: false, error: "Say what you want to learn (at least 5 characters)." };
  if (t.length > LIMITS.title) return { ok: false, error: `Keep the title under ${LIMITS.title} characters.` };
  if (d.length > LIMITS.details) return { ok: false, error: `Keep the details under ${LIMITS.details} characters.` };
  if (!/^\d+(\.\d{1,4})?$/.test(input.budget.trim()) || !Number.isFinite(budget))
    return { ok: false, error: "Budget must be a number in NEAR, e.g. 1 or 0.5." };
  if (budget < LIMITS.minBudget) return { ok: false, error: `The minimum budget is ${LIMITS.minBudget} NEAR.` };
  if (budget > LIMITS.maxBudget) return { ok: false, error: "That budget is too large." };
  return { ok: true, value: { v: 1, t, d, b: String(budget), ts: now } };
}

export function validateOffer(note: string, now = Date.now()): Valid<OfferValue> {
  const n = clean(note);
  if (n.length > LIMITS.note) return { ok: false, error: `Keep the note under ${LIMITS.note} characters.` };
  return { ok: true, value: { v: 1, n, ts: now } };
}

/** Arguments for Social DB `set`: one index entry appended under the signer's account. */
export function buildSet(account: string, key: string, value: object) {
  return {
    data: { [account]: { index: { [ACTION]: JSON.stringify({ key, value }) } } },
    options: { refund_unused_deposit: true },
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? clean(v).slice(0, max) : "");

export function parseRequest(e: RawEntry): RequestPost | null {
  if (typeof e.account_id !== "string" || typeof e.block_height !== "number" || !isObj(e.value)) return null;
  const v = e.value;
  const title = str(v.t, LIMITS.title);
  const budget = Number(v.b);
  if (title.length < 5 || !Number.isFinite(budget) || budget < LIMITS.minBudget || budget > LIMITS.maxBudget) return null;
  return {
    learner: e.account_id,
    blockHeight: e.block_height,
    title,
    details: str(v.d, LIMITS.details),
    budget,
    ts: typeof v.ts === "number" ? v.ts : 0,
  };
}

export function parseOffer(e: RawEntry): OfferPost | null {
  if (typeof e.account_id !== "string" || typeof e.block_height !== "number") return null;
  const v = isObj(e.value) ? e.value : {};
  return { sharer: e.account_id, blockHeight: e.block_height, note: str(v.n, LIMITS.note), ts: typeof v.ts === "number" ? v.ts : 0 };
}
