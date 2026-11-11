import "server-only";
import { list, put } from "@vercel/blob";
import { cardFrom, parseCard, type PostCard, type PostValue } from "@/lib/post-format";
import { keyFrom, open, seal } from "@/lib/secret-box";

// Posts live in Vercel Blob (a public store). The card (title, summary, handle, email, media) is public JSON.
// The gated part (steps and risks) is encrypted with a key derived from the server-side blob token, so even a
// leaked storage URL shows only ciphertext. Nothing here may be imported from a client component.

export interface GatedContent {
  steps: string[];
  risks: string;
}

export const blobConfigured = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const key = () => keyFrom(process.env.BLOB_READ_WRITE_TOKEN ?? "");

const MAX_POSTS = 100;

export async function savePost(sharer: string, value: PostValue): Promise<PostCard> {
  const ts = Date.now();
  const id = `${ts}-${Math.random().toString(36).slice(2, 8)}`;
  const gated: GatedContent = { steps: value.steps, risks: value.risks };
  // Gated content first: a card must never appear without its content.
  await put(`private/${id}.bin`, seal(key(), JSON.stringify(gated)), { access: "public", contentType: "text/plain", addRandomSuffix: false });
  const card = cardFrom(value, id, sharer, ts);
  await put(`posts/${id}.json`, JSON.stringify(card), { access: "public", contentType: "application/json", addRandomSuffix: false });
  return card;
}

export async function listCards(): Promise<PostCard[]> {
  const out: PostCard[] = [];
  let cursor: string | undefined;
  const blobs: { url: string }[] = [];
  do {
    const page = await list({ prefix: "posts/", limit: 200, cursor });
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

export async function readGated(id: string): Promise<GatedContent | null> {
  if (!/^[0-9]+-[a-z0-9]{1,8}$/.test(id)) return null;
  try {
    const page = await list({ prefix: `private/${id}.bin`, limit: 1 });
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
