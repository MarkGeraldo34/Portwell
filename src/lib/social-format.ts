// Pure helpers for learner requests and sharer offers stored on NEAR Social DB (no network, easy to test).
// Social DB stores a tree of data per account, and only that account can write to its own part:
//   <learner>/portwell/request/<id>              -> JSON text of a request (id = creation time in ms)
//   <sharer>/portwell/offer/<learner>_<id>       -> JSON text of an offer to teach that request
// Anyone can read every account's tree with a wildcard, e.g. "*/portwell/request/*".

export const APP = "portwell";
export const REQUEST_KEYS = [`*/${APP}/request/*`];
export const OFFER_KEYS = [`*/${APP}/offer/*`];
export const offerId = (learner: string, requestId: string) => `${learner}_${requestId}`;

export const LIMITS = { title: 80, details: 300, note: 140, minBudget: 0.1, maxBudget: 100_000 };

export interface RequestValue {
  v: 1;
  t: string; // what the learner wants to learn
  d: string; // details
  b: string; // budget in NEAR, as a plain decimal string
  ts: number; // client time, display and sorting only
}
export interface OfferValue {
  v: 1;
  n: string; // optional note
  ts: number;
}
export interface RequestPost {
  learner: string;
  id: string;
  title: string;
  details: string;
  budget: number;
  ts: number;
}
export interface OfferPost {
  sharer: string;
  note: string;
  ts: number;
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

const WRITE_OPTIONS = { refund_unused_deposit: true };

/** Arguments for Social DB `set`: a new request under the learner's own account. */
export function buildRequestSet(account: string, id: string, value: RequestValue) {
  return { data: { [account]: { [APP]: { request: { [id]: JSON.stringify(value) } } } }, options: WRITE_OPTIONS };
}

/** Arguments for Social DB `set`: an offer under the sharer's own account, tied to one request. */
export function buildOfferSet(account: string, learner: string, requestId: string, value: OfferValue) {
  return { data: { [account]: { [APP]: { offer: { [offerId(learner, requestId)]: JSON.stringify(value) } } } }, options: WRITE_OPTIONS };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? clean(v).slice(0, max) : "");

/** Walks a Social DB `get` result: { account: { portwell: { <kind>: { <id>: "json text" } } } }. */
function* leaves(tree: unknown, kind: "request" | "offer"): Generator<{ account: string; id: string; value: Record<string, unknown> }> {
  if (!isObj(tree)) return;
  for (const [account, data] of Object.entries(tree)) {
    const leaf = isObj(data) && isObj(data[APP]) ? (data[APP] as Record<string, unknown>)[kind] : null;
    if (!isObj(leaf)) continue;
    for (const [id, text] of Object.entries(leaf)) {
      if (typeof text !== "string" || text.length > 2000) continue;
      try {
        const value = JSON.parse(text);
        if (isObj(value)) yield { account, id, value };
      } catch {
        /* ignore malformed entries */
      }
    }
  }
}

/** All valid requests, newest first. Malformed or out-of-range entries are dropped. */
export function parseRequests(tree: unknown): RequestPost[] {
  const out: RequestPost[] = [];
  for (const { account, id, value } of leaves(tree, "request")) {
    const title = str(value.t, LIMITS.title);
    const budget = Number(value.b);
    if (title.length < 5 || !/^\d+$/.test(id) || !Number.isFinite(budget) || budget < LIMITS.minBudget || budget > LIMITS.maxBudget) continue;
    out.push({ learner: account, id, title, details: str(value.d, LIMITS.details), budget, ts: typeof value.ts === "number" ? value.ts : Number(id) });
  }
  return out.sort((a, b) => b.ts - a.ts || a.id.localeCompare(b.id));
}

/** Offers for one request, one per sharer. */
export function parseOffers(tree: unknown, learner: string, requestId: string): OfferPost[] {
  const want = offerId(learner, requestId);
  const out: OfferPost[] = [];
  for (const { account, id, value } of leaves(tree, "offer")) {
    if (id !== want) continue;
    out.push({ sharer: account, note: str(value.n, LIMITS.note), ts: typeof value.ts === "number" ? value.ts : 0 });
  }
  return out.sort((a, b) => a.ts - b.ts);
}
