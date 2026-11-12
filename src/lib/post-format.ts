// Pure helpers for a sharer's post: validation, normalisation, media rules and a content hash.
// Used by the browser (to validate and to hash what the wallet signs) and by the server (to re-check everything).

export const POST_LIMITS = {
  title: 80,
  summary: 300,
  step: 300,
  steps: 12,
  risks: 1000,
  media: 6,
  url: 500,
  handle: 15,
  email: 120,
  maxCapital: 100_000,
  minCapital: 0.1,
};

export type Risk = "low" | "medium" | "high";
export type MediaKind = "image" | "video" | "link";

export interface MediaItem {
  kind: MediaKind;
  url: string;
  upload: boolean; // true when the file was uploaded to Portwell's own storage
}

/** What the form collects. */
import { parseDuration, validateDuration, type Duration } from "./duration.ts";

export interface PostInput {
  title: string;
  summary: string;
  steps: string[];
  risks: string;
  risk: string;
  capitalNeededNear: string;
  durationN: string; // how long the sharer will share this strategy
  durationUnit: string; // "days" | "months"
  xHandle: string;
  email: string;
  media: { url: string; upload?: boolean }[];
}

/** A validated, normalised post. Key order is fixed so JSON.stringify gives the same text everywhere. */
export interface PostValue {
  title: string;
  summary: string;
  steps: string[];
  risks: string;
  risk: Risk;
  capitalNeededNear: number;
  duration: Duration;
  xHandle: string;
  email: string;
  media: MediaItem[];
}

/** The public part of a post: what the feed and sharer page show. Gated text is stored separately. */
export interface PostCard {
  v: 1;
  id: string;
  sharer: string;
  title: string;
  summary: string;
  risk: Risk;
  capitalNeededNear: number;
  duration?: Duration; // missing on posts made before durations existed
  steps: number; // how many steps, not the steps themselves
  xHandle?: string;
  email?: string;
  media: MediaItem[];
  ts: number;
}

type Valid<T> = { ok: true; value: T } | { ok: false; error: string };

const clean = (s: unknown) =>
  typeof s === "string" ? s.replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ").replace(/[ \t]+/g, " ").trim() : "";

export const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "avif"];
export const VIDEO_EXT = ["mp4", "webm", "mov"];
export const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

export function kindFromPath(pathname: string): MediaKind {
  const ext = pathname.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXT.includes(ext)) return "image";
  if (VIDEO_EXT.includes(ext)) return "video";
  return "link";
}

const BAD_HOST = /^(localhost|.*\.local|.*\.internal|\d{1,3}(\.\d{1,3}){3}|\[.*\])$/i;

export function validateMedia(raw: { url: string; upload?: boolean }): Valid<MediaItem> {
  const text = typeof raw.url === "string" ? raw.url.trim() : "";
  if (!text || text.length > POST_LIMITS.url) return { ok: false, error: "A media link is empty or too long." };
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return { ok: false, error: `“${text.slice(0, 40)}” is not a valid link.` };
  }
  if (u.protocol !== "https:") return { ok: false, error: "Media links must start with https://" };
  if (u.username || u.password) return { ok: false, error: "Media links cannot contain a username or password." };
  if (BAD_HOST.test(u.hostname) || !u.hostname.includes(".")) return { ok: false, error: "That media link host is not allowed." };
  const upload = raw.upload === true;
  if (upload && !u.hostname.endsWith(BLOB_HOST_SUFFIX)) return { ok: false, error: "Uploaded media must come from Portwell's storage." };
  const kind = kindFromPath(u.pathname);
  if (upload && kind === "link") return { ok: false, error: "Only images and videos can be uploaded." };
  return { ok: true, value: { kind, url: u.toString(), upload } };
}

export function validateHandle(input: string): Valid<string> {
  const h = clean(input).replace(/^@/, "");
  if (!h) return { ok: false, error: "Enter your X handle, e.g. @portwell." };
  if (/[\/\s:.]/.test(h)) return { ok: false, error: "Enter just your X handle (no link), e.g. @portwell." };
  if (!/^[A-Za-z0-9_]{1,15}$/.test(h)) return { ok: false, error: "That is not a valid X handle (letters, numbers and _, up to 15)." };
  return { ok: true, value: h };
}

export function validateEmail(input: string): Valid<string> {
  const e = clean(input).toLowerCase();
  if (!e) return { ok: false, error: "Enter your email address." };
  if (e.length > POST_LIMITS.email || e.includes("..") || !/^[a-z0-9._%+-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/.test(e))
    return { ok: false, error: "That does not look like a valid email address." };
  return { ok: true, value: e };
}

export function normalizePost(input: PostInput): Valid<PostValue> {
  const title = clean(input.title);
  const summary = clean(input.summary);
  const risks = clean(input.risks);
  const steps = (Array.isArray(input.steps) ? input.steps : []).map(clean).filter(Boolean);
  if (title.length < 5) return { ok: false, error: "Give the post a title (at least 5 characters)." };
  if (title.length > POST_LIMITS.title) return { ok: false, error: `Keep the title under ${POST_LIMITS.title} characters.` };
  if (summary.length < 10) return { ok: false, error: "Write a short summary (at least 10 characters)." };
  if (summary.length > POST_LIMITS.summary) return { ok: false, error: `Keep the summary under ${POST_LIMITS.summary} characters.` };
  if (steps.length < 1) return { ok: false, error: "Add at least one step." };
  if (steps.length > POST_LIMITS.steps) return { ok: false, error: `Use at most ${POST_LIMITS.steps} steps.` };
  if (steps.some((s) => s.length > POST_LIMITS.step)) return { ok: false, error: `Keep each step under ${POST_LIMITS.step} characters.` };
  if (risks.length < 10) return { ok: false, error: "Describe the risks and downsides (at least 10 characters)." };
  if (risks.length > POST_LIMITS.risks) return { ok: false, error: `Keep the risks under ${POST_LIMITS.risks} characters.` };
  if (input.risk !== "low" && input.risk !== "medium" && input.risk !== "high") return { ok: false, error: "Pick a risk level." };
  const capText = clean(input.capitalNeededNear);
  const capital = Number(capText);
  if (!/^\d+(\.\d{1,4})?$/.test(capText) || !Number.isFinite(capital) || capital > POST_LIMITS.maxCapital)
    return { ok: false, error: "Capital needed must be a number in NEAR, e.g. 1 or 5." };
  // This amount is also the monthly price learners pay, and the escrow contract's minimum price is 0.1 NEAR.
  if (capital < POST_LIMITS.minCapital) return { ok: false, error: `Capital needed is the amount learners pay each month: at least ${POST_LIMITS.minCapital} NEAR.` };

  const duration = validateDuration(input.durationN, input.durationUnit);
  if (!duration.ok) return duration;

  const handle = validateHandle(input.xHandle);
  if (!handle.ok) return handle;
  const email = validateEmail(input.email);
  if (!email.ok) return email;

  const rawMedia = Array.isArray(input.media) ? input.media : [];
  if (rawMedia.length > POST_LIMITS.media) return { ok: false, error: `Add at most ${POST_LIMITS.media} media items.` };
  const media: MediaItem[] = [];
  const seen = new Set<string>();
  for (const m of rawMedia) {
    const v = validateMedia(m);
    if (!v.ok) return v;
    if (seen.has(v.value.url)) continue;
    seen.add(v.value.url);
    media.push(v.value);
  }

  return {
    ok: true,
    value: { title, summary, steps, risks, risk: input.risk, capitalNeededNear: capital, duration: duration.value, xHandle: handle.value, email: email.value, media },
  };
}

/** SHA-256 (hex) of the normalised post. The wallet signs this, so a signature cannot be reused for other content. */
export async function hashPost(p: PostValue): Promise<string> {
  const canonical = JSON.stringify([p.title, p.summary, p.steps, p.risks, p.risk, p.capitalNeededNear, p.duration.n, p.duration.unit, p.xHandle, p.email, p.media.map((m) => [m.kind, m.url, m.upload])]);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function cardFrom(p: PostValue, id: string, sharer: string, ts: number): PostCard {
  return {
    v: 1,
    id,
    sharer,
    title: p.title,
    summary: p.summary,
    risk: p.risk,
    capitalNeededNear: p.capitalNeededNear,
    duration: p.duration,
    steps: p.steps.length,
    xHandle: p.xHandle,
    email: p.email,
    media: p.media,
    ts,
  };
}

/** Reads a stored card back, dropping anything malformed. Never trusts the stored JSON's shape. */
export function parseCard(raw: unknown): PostCard | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || typeof r.id !== "string" || typeof r.sharer !== "string" || typeof r.ts !== "number") return null;
  const title = clean(r.title);
  const summary = clean(r.summary);
  if (!title || !summary) return null;
  if (r.risk !== "low" && r.risk !== "medium" && r.risk !== "high") return null;
  const capital = Number(r.capitalNeededNear);
  const steps = Number(r.steps);
  if (!Number.isFinite(capital) || capital < 0 || !Number.isInteger(steps) || steps < 0) return null;
  const duration = parseDuration(r.duration);
  const handle = typeof r.xHandle === "string" ? validateHandle(r.xHandle) : null;
  const email = typeof r.email === "string" ? validateEmail(r.email) : null;
  const media: MediaItem[] = [];
  if (Array.isArray(r.media)) {
    for (const m of r.media.slice(0, POST_LIMITS.media)) {
      if (typeof m !== "object" || m === null) continue;
      const v = validateMedia({ url: String((m as Record<string, unknown>).url ?? ""), upload: (m as Record<string, unknown>).upload === true });
      if (v.ok) media.push(v.value);
    }
  }
  return {
    v: 1,
    id: r.id,
    sharer: r.sharer,
    title: title.slice(0, POST_LIMITS.title),
    summary: summary.slice(0, POST_LIMITS.summary),
    risk: r.risk,
    capitalNeededNear: capital,
    steps,
    ...(duration ? { duration } : {}),
    ...(handle?.ok ? { xHandle: handle.value } : {}),
    ...(email?.ok ? { email: email.value } : {}),
    media,
    ts: r.ts,
  };
}
