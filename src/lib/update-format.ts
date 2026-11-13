// A sharer's follow-up update to subscribers. Pure helpers (validation, content hash, weekly cadence), no network.
export const UPDATE_LIMITS = { title: 80, body: 1500 };

export interface UpdateInput {
  postId: string;
  title: string;
  body: string;
}
export interface UpdateValue extends UpdateInput {
  ts: number;
}

type Valid<T> = { ok: true; value: T } | { ok: false; error: string };
const clean = (s: unknown) => (typeof s === "string" ? s.replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ").replace(/[ \t]+/g, " ").trim() : "");

export function validateUpdate(input: UpdateInput): Valid<UpdateInput> {
  const postId = typeof input.postId === "string" ? input.postId : "";
  if (!/^[0-9]+-[a-z0-9]{1,8}$/.test(postId)) return { ok: false, error: "Pick which of your posts this update belongs to." };
  const title = clean(input.title).replace(/\s+/g, " ");
  const body = clean(input.body);
  if (title.length < 3) return { ok: false, error: "Give the update a title (at least 3 characters)." };
  if (title.length > UPDATE_LIMITS.title) return { ok: false, error: `Keep the title under ${UPDATE_LIMITS.title} characters.` };
  if (body.length < 10) return { ok: false, error: "Write the update (at least 10 characters)." };
  if (body.length > UPDATE_LIMITS.body) return { ok: false, error: `Keep the update under ${UPDATE_LIMITS.body} characters.` };
  return { ok: true, value: { postId, title, body } };
}

/** SHA-256 (hex) of the update. The wallet signs this, so a signature cannot be reused for other content. */
export async function hashUpdate(u: UpdateInput): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([u.postId, u.title, u.body])));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const WEEK = 7 * 24 * 3600 * 1000;

/**
 * Weekly cadence for one subscription. Week 1 is covered by the strategy post itself, so a sharer owes one update
 * for every further week that has fully passed (at most 3 of the 4 paid weeks), counted from the subscription start.
 */
export function cadence(startMs: number, updateTimes: number[], nowMs: number, tranches = 4): { owed: number; posted: number; behind: number } {
  const weeksPassed = Math.max(0, Math.min(tranches, Math.floor((nowMs - startMs) / WEEK)));
  const owed = Math.min(tranches - 1, weeksPassed);
  const posted = updateTimes.filter((t) => t >= startMs).length;
  return { owed, posted, behind: Math.max(0, owed - posted) };
}
