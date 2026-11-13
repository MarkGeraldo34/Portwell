// Proves that a sharer owns the X account they claim. The site gives a short code tied to their NEAR account and
// the handle; they post it from that X account and paste the link; the server reads the tweet and checks the author
// and the code. Pure helpers only (the network fetch lives in src/server/x-verify.ts).
import { createHmac } from "node:crypto";

export const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I, easy to read and type

/** "PW-" plus 6 characters. Same account + handle always gives the same code; nobody can guess another account's code. */
export function makeCode(secret: string, account: string, handle: string): string {
  const d = createHmac("sha256", `portwell-xverify-v1:${secret}`).update(`${account}|${handle.toLowerCase()}`).digest();
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[d[i] % ALPHABET.length];
  return `PW-${out}`;
}

/** The text the sharer is asked to post. */
export const challengeText = (code: string, account: string) => `Verifying my X account for Portwell on NEAR. ${code} (${account})`;

export interface TweetRef {
  handle: string;
  id: string;
  canonical: string;
}

/** Accepts https://x.com/<handle>/status/<id> (also twitter.com, www., mobile.). Anything else is rejected. */
export function parseTweetUrl(input: string): TweetRef | null {
  if (typeof input !== "string" || input.length > 300) return null;
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !/^(www\.|mobile\.)?(x|twitter)\.com$/i.test(u.hostname)) return null;
  const m = /^\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})\/?$/.exec(u.pathname);
  if (!m) return null;
  return { handle: m[1], id: m[2], canonical: `https://x.com/${m[1]}/status/${m[2]}` };
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const toText = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, e: string) => {
      if (e[0] === "#") {
        const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : " ";
      }
      return ENTITIES[e.toLowerCase()] ?? " ";
    });

/** What X's public oEmbed endpoint returns for a tweet (only the fields we use). */
export interface Oembed {
  author_url?: unknown;
  html?: unknown;
}

export type TweetCheck = { ok: true } | { ok: false; error: string };

/** The tweet must be written by the claimed handle and contain the code. */
export function checkTweet(o: Oembed, want: { handle: string; code: string }): TweetCheck {
  if (typeof o?.author_url !== "string" || typeof o.html !== "string") return { ok: false, error: "Could not read that tweet." };
  let author = "";
  try {
    author = new URL(o.author_url).pathname.split("/").filter(Boolean)[0] ?? "";
  } catch {
    /* handled below */
  }
  if (author.toLowerCase() !== want.handle.toLowerCase()) return { ok: false, error: `That tweet was posted by @${author || "someone else"}, not @${want.handle}.` };
  if (!toText(o.html).toUpperCase().includes(want.code.toUpperCase())) return { ok: false, error: `The tweet does not contain your code ${want.code}. Post the code exactly as shown.` };
  return { ok: true };
}
