import "server-only";
import { del as vDel, list as vList, put as vPut } from "@vercel/blob";
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

/**
 * Cloudflare R2 (S3 compatible). When these four variables are set, ALL post, update, chat and verification data
 * goes to a private R2 bucket instead of Vercel Blob. R2's free tier allows a million writes/lists a month.
 * Uploaded images and videos still use Vercel Blob (the browser uploads straight to it), pasted media links need no storage.
 */
const r2Env = () => {
  const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: id, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET: bucket } = process.env;
  return account && id && secret && bucket ? { account, id, secret, bucket } : null;
};
export const usingR2 = () => r2Env() !== null;

/** Why Vercel Blob (used for media uploads) cannot be used, or null when it is ready. */
export function vercelBlobProblem(): string | null {
  if (!blobToken() && !process.env.BLOB_STORE_ID) return "file uploads need Vercel Blob, which is not set up. Paste a media link instead";
  return null;
}

/** Why storage cannot be used, or null when it is ready. */
export function blobProblem(): string | null {
  if (!usingR2() && !blobToken() && !process.env.BLOB_STORE_ID) return "post storage is not set up yet (Cloudflare R2 or Vercel Blob)";
  if (!contentSecret()) return "CONTENT_SECRET is not set in Vercel (a random secret used to encrypt locked steps)";
  return null;
}

export const blobConfigured = () => blobProblem() === null;
const key = () => keyFrom(contentSecret() ?? "");

// ---- One small storage interface over R2 and Vercel Blob. Everything below uses only these four calls. ----

interface Obj {
  pathname: string;
  /** Reads the object as text, or null if it is missing or unreadable. */
  text: () => Promise<string | null>;
}

let s3: S3Client | null = null;
const client = () => {
  const r = r2Env()!;
  return (s3 ??= new S3Client({ region: "auto", endpoint: `https://${r.account}.r2.cloudflarestorage.com`, credentials: { accessKeyId: r.id, secretAccessKey: r.secret } }));
};
const r2Read = (pathname: string) => async (): Promise<string | null> => {
  try {
    const out = await client().send(new GetObjectCommand({ Bucket: r2Env()!.bucket, Key: pathname }));
    return (await out.Body?.transformToString()) ?? null;
  } catch {
    return null;
  }
};
const urlRead = (url: string) => async (): Promise<string | null> => {
  try {
    const res = await fetch(url, { cache: "no-store" });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
};

async function putObj(pathname: string, body: string, contentType: string): Promise<void> {
  if (usingR2()) {
    await client().send(new PutObjectCommand({ Bucket: r2Env()!.bucket, Key: pathname, Body: body, ContentType: contentType }));
    return;
  }
  await vPut(pathname, body, { access: "public", contentType, addRandomSuffix: false, allowOverwrite: true, token: blobToken() });
}

/** Objects whose path starts with `prefix`, at most `max`. */
async function listObjs(prefix: string, max: number): Promise<Obj[]> {
  const out: Obj[] = [];
  if (usingR2()) {
    let token: string | undefined;
    do {
      const page = await client().send(new ListObjectsV2Command({ Bucket: r2Env()!.bucket, Prefix: prefix, ContinuationToken: token, MaxKeys: Math.min(1000, max - out.length) }));
      for (const o of page.Contents ?? []) if (o.Key) out.push({ pathname: o.Key, text: r2Read(o.Key) });
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token && out.length < max);
    return out;
  }
  let cursor: string | undefined;
  do {
    const page = await vList({ prefix, limit: Math.min(1000, max - out.length), cursor, token: blobToken() });
    for (const b of page.blobs) out.push({ pathname: b.pathname, text: urlRead(b.url) });
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor && out.length < max);
  return out;
}

async function delObjs(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  if (usingR2()) {
    await client().send(new DeleteObjectsCommand({ Bucket: r2Env()!.bucket, Delete: { Objects: paths.map((Key) => ({ Key })) } }));
    return;
  }
  const found = (await Promise.all(paths.map((p) => vList({ prefix: p, limit: 1, token: blobToken() })))).flatMap((r) => r.blobs.filter((b) => paths.includes(b.pathname)).map((b) => b.url));
  if (found.length) await vDel(found, { token: blobToken() });
}

/** One object by exact path (R2 reads it directly; Vercel Blob needs a list to find its URL). */
async function getObj(pathname: string): Promise<Obj | null> {
  if (usingR2()) {
    const text = await r2Read(pathname)();
    return text === null ? null : { pathname, text: async () => text };
  }
  return (await listObjs(pathname, 1)).find((o) => o.pathname === pathname) ?? null;
}

const MAX_POSTS = 100;

export async function savePost(sharer: string, value: PostValue): Promise<PostCard> {
  const ts = Date.now();
  const id = `${ts}-${Math.random().toString(36).slice(2, 8)}`;
  const gated: GatedContent = { steps: value.steps, risks: value.risks };
  // Gated content first: a card must never appear without its content.
  await putObj(`private/${id}.bin`, seal(key(), JSON.stringify(gated)), "text/plain");
  const card = cardFrom(value, id, sharer, ts);
  await putObj(`posts/${id}.json`, JSON.stringify(card), "application/json");
  cardsCache = null;
  return card;
}

// The feed lists posts on every page view. A short cache keeps storage operations (and the free quota) from running out.
let cardsCache: { at: number; cards: PostCard[] } | null = null;
const CARDS_TTL_MS = 30_000;

export async function listCards(): Promise<PostCard[]> {
  if (cardsCache && Date.now() - cardsCache.at < CARDS_TTL_MS) return cardsCache.cards;
  const objs = await listObjs("posts/", 400);
  const cards = await Promise.all(
    objs.map(async (o) => {
      try {
        const t = await o.text();
        return t ? parseCard(JSON.parse(t)) : null;
      } catch {
        return null;
      }
    }),
  );
  const out = cards.filter((c): c is PostCard => !!c).sort((x, y) => y.ts - x.ts).slice(0, MAX_POSTS);
  cardsCache = { at: Date.now(), cards: out };
  return out;
}

/** Deletes a post (card and encrypted content). Only the account that published it may. */
export async function deletePost(id: string, sharer: string): Promise<"deleted" | "not_found" | "forbidden"> {
  if (!/^[0-9]+-[a-z0-9]{1,8}$/.test(id)) return "not_found";
  const cardObj = await getObj(`posts/${id}.json`);
  if (!cardObj) return "not_found";
  const text = await cardObj.text();
  let card: PostCard | null = null;
  try {
    card = text ? parseCard(JSON.parse(text)) : null;
  } catch {
    card = null;
  }
  if (!card) return "not_found";
  if (card.sharer !== sharer) return "forbidden";
  await delObjs([`posts/${id}.json`, `private/${id}.bin`]);
  cardsCache = null;
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
  await putObj(`updates/${sharer}/${ts}-${Math.random().toString(36).slice(2, 8)}.bin`, seal(key(), JSON.stringify(stored)), "text/plain");
  return stored;
}

async function updateBlobs(sharer: string): Promise<{ obj: Obj; ts: number }[]> {
  const out: { obj: Obj; ts: number }[] = [];
  for (const obj of await listObjs(`updates/${sharer}/`, 400)) {
    const ts = Number(obj.pathname.split("/").pop()?.split("-")[0]);
    if (Number.isFinite(ts)) out.push({ obj, ts });
  }
  return out.sort((x, y) => y.ts - x.ts);
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
        const raw = await b.obj.text();
        const text = raw ? open(key(), raw) : null;
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
  await putObj(`${chatPrefix(sharer, learner)}${ts}-${from === "sharer" ? "s" : "l"}-${Math.random().toString(36).slice(2, 7)}.bin`, seal(key(), JSON.stringify({ text })), "text/plain");
  return { ts };
}

/** Messages newer than `since` (ms), oldest first. Only call after the viewer is authorised for this pair. */
export async function listChatMessages(sharer: string, learner: string, since: number): Promise<{ from: "learner" | "sharer"; text: string; ts: number }[]> {
  const items: { obj: Obj; ts: number; from: "learner" | "sharer" }[] = [];
  for (const obj of await listObjs(chatPrefix(sharer, learner), 300)) {
    const [ts, who] = (obj.pathname.split("/").pop() ?? "").split("-");
    const n = Number(ts);
    if (Number.isFinite(n) && n > since) items.push({ obj, ts: n, from: who === "s" ? "sharer" : "learner" });
  }
  items.sort((x, y) => x.ts - y.ts);
  const read = await Promise.all(
    items.slice(-100).map(async (m) => {
      try {
        const raw = await m.obj.text();
        const text = raw ? open(key(), raw) : null;
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
    const obj = await getObj(`private/${id}.bin`);
    const raw = obj ? await obj.text() : null;
    const text = raw ? open(key(), raw) : null;
    if (!text) return null;
    const parsed = JSON.parse(text) as Partial<GatedContent>;
    if (!Array.isArray(parsed.steps) || typeof parsed.risks !== "string") return null;
    return { steps: parsed.steps.filter((x): x is string => typeof x === "string"), risks: parsed.risks };
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
    const obj = await getObj(xPath(account));
    const raw = obj ? await obj.text() : null;
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<XVerified>;
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
  for (const o of await listObjs("xverified/", 1000)) {
    try {
      const raw = await o.text();
      const j = raw ? (JSON.parse(raw) as Partial<XVerified>) : null;
      if (j && typeof j.handle === "string" && j.handle.toLowerCase() === want) return o.pathname.slice("xverified/".length).replace(/\.json$/, "");
    } catch {
      /* skip unreadable entries */
    }
  }
  return null;
}

export async function saveXVerified(account: string, v: XVerified): Promise<void> {
  await putObj(xPath(account), JSON.stringify(v), "application/json");
}

const incomingCache = new Map<string, { at: number; v: { from: string; ts: number }[] }>();

/**
 * Who has written to this account in chat, and when (newest message per conversation, only if the other person
 * sent it). Metadata only, read from file names: message text is never touched. Used for the unread badges.
 */
export async function chatIncoming(account: string): Promise<{ from: string; ts: number }[]> {
  if (!/^[a-z0-9._-]{2,64}$/.test(account) || !blobConfigured()) return [];
  const hit = incomingCache.get(account);
  if (hit && Date.now() - hit.at < 30_000) return hit.v;
  const latest = new Map<string, { ts: number; mine: boolean }>();
  // Conversations are stored as chat/<sharer>/<learner>/..., so only the ones that name this account are read.
  for (const b of await listObjs("chat/", 5000)) {
    const [root, sharer, learner, file] = b.pathname.split("/");
    if (root !== "chat" || !file || (sharer !== account && learner !== account)) continue;
    const [tsText, who] = file.split("-");
    const ts = Number(tsText);
    if (!Number.isFinite(ts)) continue;
    const iAmSharer = sharer === account;
    const mine = (who === "s") === iAmSharer;
    const other = iAmSharer ? learner : sharer;
    const prev = latest.get(other);
    if (!prev || ts > prev.ts) latest.set(other, { ts, mine });
  }
  const v = Array.from(latest, ([from, m]) => ({ from, ts: m.ts, mine: m.mine })).filter((m) => !m.mine).map(({ from, ts }) => ({ from, ts }));
  incomingCache.set(account, { at: Date.now(), v });
  return v;
}

/** Lessons live at lessons/<sharer>/<learner>/<requestId>/<ts>-<rand>.bin, encrypted. */
const lessonPrefix = (sharer: string, learner: string, requestId: string) => `lessons/${sharer}/${learner}/${requestId}/`;

export async function saveLesson(sharer: string, learner: string, requestId: string, l: { title: string; body: string }): Promise<{ ts: number }> {
  const ts = Date.now();
  await putObj(`${lessonPrefix(sharer, learner, requestId)}${ts}-${Math.random().toString(36).slice(2, 7)}.bin`, seal(key(), JSON.stringify(l)), "text/plain");
  return { ts };
}

/** Newest first. Only call after the viewer's chat session token has been checked for this sharer and learner. */
export async function listLessons(sharer: string, learner: string, requestId: string): Promise<{ title: string; body: string; ts: number }[]> {
  const objs = await listObjs(lessonPrefix(sharer, learner, requestId), 200);
  const read = await Promise.all(
    objs.map(async (o) => {
      try {
        const ts = Number(o.pathname.split("/").pop()?.split("-")[0]);
        const raw = await o.text();
        const text = raw ? open(key(), raw) : null;
        const p = text ? (JSON.parse(text) as { title?: unknown; body?: unknown }) : null;
        return p && Number.isFinite(ts) && typeof p.title === "string" && typeof p.body === "string" ? { title: p.title, body: p.body, ts } : null;
      } catch {
        return null;
      }
    }),
  );
  return read.filter((x): x is { title: string; body: string; ts: number } => x !== null).sort((a, b) => b.ts - a.ts);
}
