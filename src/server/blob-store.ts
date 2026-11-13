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
