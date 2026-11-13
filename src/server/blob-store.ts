import "server-only";
import { del, list, put } from "@vercel/blob";
import { cardFrom, parseCard, type PostCard, type PostValue } from "@/lib/post-format";
import { keyFrom, open, seal } from "@/lib/secret-box";

// Posts live in Vercel Blob (a public store). The card (title, summary, handle, email, media) is public JSON.
// The gated part (steps and risks) is encrypted with a key derived from the server-side blob token, so even a
// leaked storage URL shows only ciphertext. Nothing here may be imported from a client component.

export interface GatedContent {
  steps: string[];
  risks: string;
}

/**
 * Credentials. Older Vercel Blob stores use a read-write token (BLOB_READ_WRITE_TOKEN, or another name ending in
 * _READ_WRITE_TOKEN if you chose a custom prefix). Newer stores have no token: they sign in with Vercel's OIDC
 * identity and only expose BLOB_STORE_ID. The SDK handles both, so we only check that one of them is present.
 */
export function blobToken(): string | undefined {
  const direct = process.env.BLOB_READ_WRITE_TOKEN;
  if (direct) return direct;
  const name = Object.keys(process.env).find((k) => k.endsWith("_READ_WRITE_TOKEN") && process.env[k]);
  return name ? process.env[name] : undefined;
}

/** True when the store signs in with Vercel OIDC (no read-write token). Uploads then use presigned URLs. */
export const blobUsesOidc = () => !blobToken() && !!process.env.BLOB_STORE_ID;

/**
 * Secret used to encrypt the gated part of posts. CONTENT_SECRET is preferred. A read-write token also works as a
 * secret, but BLOB_STORE_ID does not: it appears in every public blob URL, so it is not secret.
 */
const contentSecret = () => process.env.CONTENT_SECRET || blobToken();

/** Why storage cannot be used, or null when it is ready. */
export function blobProblem(): string | null {
  if (!blobToken() && !process.env.BLOB_STORE_ID) return "post storage is not set up yet (Vercel Blob)";
  if (!contentSecret()) return "CONTENT_SECRET is not set in Vercel (a random secret used to encrypt locked steps)";
  return null;
}

export const blobConfigured = () => blobProblem() === null;
const key = () => keyFrom(contentSecret() ?? "");

const MAX_POSTS = 100;

export async function savePost(sharer: string, value: PostValue): Promise<PostCard> {
  const ts = Date.now();
  const id = `${ts}-${Math.random().toString(36).slice(2, 8)}`;
  const gated: GatedContent = { steps: value.steps, risks: value.risks };
  // Gated content first: a card must never appear without its content.
  await put(`private/${id}.bin`, seal(key(), JSON.stringify(gated)), { access: "public", contentType: "text/plain", addRandomSuffix: false, token: blobToken() });
  const card = cardFrom(value, id, sharer, ts);
  await put(`posts/${id}.json`, JSON.stringify(card), { access: "public", contentType: "application/json", addRandomSuffix: false, token: blobToken() });
  return card;
}

export async function listCards(): Promise<PostCard[]> {
  const out: PostCard[] = [];
  let cursor: string | undefined;
  const blobs: { url: string }[] = [];
  do {
    const page = await list({ prefix: "posts/", limit: 200, cursor, token: blobToken() });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor && blobs.length < 400);

  const cards = await Promise.all(
    blobs.map(async (b) => {
      try {
        const res = await fetch(b.url, { cache: "no-store" });
        return res.ok ? parseCard(await res.json()) : null;
      } catch {
        return null;
      }
    }),
  );
  for (const c of cards) if (c) out.push(c);
  return out.sort((a, b) => b.ts - a.ts).slice(0, MAX_POSTS);
}

/** Deletes a post (card and encrypted content). Only the account that published it may. */
export async function deletePost(id: string, sharer: string): Promise<"deleted" | "not_found" | "forbidden"> {
  if (!/^[0-9]+-[a-z0-9]{1,8}$/.test(id)) return "not_found";
  const cardPage = await list({ prefix: `posts/${id}.json`, limit: 1, token: blobToken() });
  const cardBlob = cardPage.blobs[0];
  if (!cardBlob) return "not_found";
  const res = await fetch(cardBlob.url, { cache: "no-store" });
  const card = res.ok ? parseCard(await res.json()) : null;
  if (!card) return "not_found";
  if (card.sharer !== sharer) return "forbidden";
  const gated = await list({ prefix: `private/${id}.bin`, limit: 1, token: blobToken() });
  await del([cardBlob.url, ...gated.blobs.map((b) => b.url)], { token: blobToken() });
  return "deleted";
}

export interface StoredUpdate {
  postId: string;
  title: string;
  body: string;
  ts: number;
}

/** Updates live at updates/<sharer>/<ts>-<rand>.bin (encrypted), so the public listing shows how many and when, never what. */
export async function saveUpdate(sharer: string, u: { postId: string; title: string; body: string }): Promise<StoredUpdate> {
  const ts = Date.now();
  const stored: StoredUpdate = { ...u, ts };
  await put(`updates/${sharer}/${ts}-${Math.random().toString(36).slice(2, 8)}.bin`, seal(key(), JSON.stringify(stored)), {
    access: "public",
    contentType: "text/plain",
    addRandomSuffix: false,
    token: blobToken(),
  });
  return stored;
}

async function updateBlobs(sharer: string): Promise<{ url: string; ts: number }[]> {
  const out: { url: string; ts: number }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: `updates/${sharer}/`, limit: 200, cursor, token: blobToken() });
    for (const b of page.blobs) {
      const ts = Number(b.pathname.split("/").pop()?.split("-")[0]);
      if (Number.isFinite(ts)) out.push({ url: b.url, ts });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor && out.length < 400);
  return out.sort((a, b) => b.ts - a.ts);
}

/** When each update was posted. Public: carries no content. */
export async function updateTimes(sharer: string): Promise<number[]> {
  return (await updateBlobs(sharer)).map((b) => b.ts);
}

/** The decrypted updates, newest first. Only call this after the viewer has been authorised. */
export async function readUpdates(sharer: string): Promise<StoredUpdate[]> {
  const blobs = (await updateBlobs(sharer)).slice(0, 50);
  const read = await Promise.all(
    blobs.map(async (b) => {
      try {
        const res = await fetch(b.url, { cache: "no-store" });
        const text = res.ok ? open(key(), await res.text()) : null;
        if (!text) return null;
        const p = JSON.parse(text) as Partial<StoredUpdate>;
        return typeof p.title === "string" && typeof p.body === "string" && typeof p.postId === "string" ? ({ postId: p.postId, title: p.title, body: p.body, ts: b.ts } as StoredUpdate) : null;
      } catch {
        return null;
      }
    }),
  );
  return read.filter((u): u is StoredUpdate => u !== null);
}

/** Secret for chat session tokens. */
export const chatSecret = () => contentSecret() ?? "";

const chatPrefix = (sharer: string, learner: string) => `chat/${sharer}/${learner}/`;

/** Messages live at chat/<sharer>/<learner>/<ts>-<l|s>-<rand>.bin, encrypted. */
export async function saveChatMessage(sharer: string, learner: string, from: "learner" | "sharer", text: string): Promise<{ ts: number }> {
  const ts = Date.now();
  await put(`${chatPrefix(sharer, learner)}${ts}-${from === "sharer" ? "s" : "l"}-${Math.random().toString(36).slice(2, 7)}.bin`, seal(key(), JSON.stringify({ text })), {
    access: "public",
    contentType: "text/plain",
    addRandomSuffix: false,
    token: blobToken(),
  });
  return { ts };
}

/** Messages newer than `since` (ms), oldest first. Only call after the viewer is authorised for this pair. */
export async function listChatMessages(sharer: string, learner: string, since: number): Promise<{ from: "learner" | "sharer"; text: string; ts: number }[]> {
  const items: { url: string; ts: number; from: "learner" | "sharer" }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: chatPrefix(sharer, learner), limit: 200, cursor, token: blobToken() });
    for (const b of page.blobs) {
      const [ts, who] = (b.pathname.split("/").pop() ?? "").split("-");
      const n = Number(ts);
      if (Number.isFinite(n) && n > since) items.push({ url: b.url, ts: n, from: who === "s" ? "sharer" : "learner" });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor && items.length < 300);
  items.sort((a, b) => a.ts - b.ts);
  const read = await Promise.all(
    items.slice(-100).map(async (m) => {
      try {
        const res = await fetch(m.url, { cache: "no-store" });
        const text = res.ok ? open(key(), await res.text()) : null;
        const t = text ? (JSON.parse(text) as { text?: unknown }).text : null;
        return typeof t === "string" ? { from: m.from, text: t, ts: m.ts } : null;
      } catch {
        return null;
      }
    }),
  );
  return read.filter((m): m is { from: "learner" | "sharer"; text: string; ts: number } => m !== null);
}

export async function readGated(id: string): Promise<GatedContent | null> {
  if (!/^[0-9]+-[a-z0-9]{1,8}$/.test(id)) return null;
  try {
    const page = await list({ prefix: `private/${id}.bin`, limit: 1, token: blobToken() });
    const blob = page.blobs[0];
    if (!blob) return null;
    const res = await fetch(blob.url, { cache: "no-store" });
    if (!res.ok) return null;
    const text = open(key(), await res.text());
    if (!text) return null;
    const parsed = JSON.parse(text) as Partial<GatedContent>;
    if (!Array.isArray(parsed.steps) || typeof parsed.risks !== "string") return null;
    return { steps: parsed.steps.filter((s): s is string => typeof s === "string"), risks: parsed.risks };
  } catch {
    return null;
  }
}

export interface XVerified {
  handle: string;
  tweet: string;
  ts: number;
}

const xPath = (account: string) => `xverified/${account}.json`;

/** The X handle this NEAR account has proven it owns, or null. Public data: it is the same handle shown on the feed. */
export async function getXVerified(account: string): Promise<XVerified | null> {
  if (!/^[a-z0-9._-]{2,64}$/.test(account) || !blobConfigured()) return null;
  try {
    const page = await list({ prefix: xPath(account), limit: 1, token: blobToken() });
    const blob = page.blobs.find((b) => b.pathname === xPath(account));
    if (!blob) return null;
    const res = await fetch(blob.url, { cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as Partial<XVerified>;
    return typeof j.handle === "string" && /^[A-Za-z0-9_]{1,15}$/.test(j.handle) ? { handle: j.handle, tweet: String(j.tweet ?? ""), ts: Number(j.ts) || 0 } : null;
  } catch {
    return null;
  }
}

/** account -> verified handle, for the accounts asked about. Unknown or unverified accounts are left out. */
export async function xVerifiedFor(accounts: string[]): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(accounts)).slice(0, 60);
  const found = await Promise.all(uniq.map(async (a) => [a, await getXVerified(a)] as const));
  const out: Record<string, string> = {};
  for (const [a, v] of found) if (v) out[a] = v.handle;
  return out;
}

/** Which account (if any) has already verified this handle. Used so one X account cannot sit behind two wallets. */
export async function xHandleOwner(handle: string): Promise<string | null> {
  const want = handle.toLowerCase();
  let cursor: string | undefined;
  const blobs: { url: string; pathname: string }[] = [];
  do {
    const page = await list({ prefix: "xverified/", limit: 200, cursor, token: blobToken() });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor && blobs.length < 1000);
  for (const b of blobs) {
    try {
      const res = await fetch(b.url, { cache: "no-store" });
      const j = res.ok ? ((await res.json()) as Partial<XVerified>) : null;
      if (j && typeof j.handle === "string" && j.handle.toLowerCase() === want) return b.pathname.slice("xverified/".length).replace(/\.json$/, "");
    } catch {
      /* skip unreadable entries */
    }
  }
  return null;
}

export async function saveXVerified(account: string, v: XVerified): Promise<void> {
  await put(xPath(account), JSON.stringify(v), { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60, token: blobToken() });
}
