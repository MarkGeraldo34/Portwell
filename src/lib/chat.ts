// Private chat between one learner and one sharer. Pure helpers: message rules and short-lived session tokens.
import { createHmac, timingSafeEqual } from "node:crypto";

export const CHAT_MAX = 500;
export const TOKEN_MS = 60 * 60 * 1000;

export interface ChatMessage {
  from: "learner" | "sharer";
  text: string;
  ts: number;
}

export function validateChatText(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const text = typeof raw === "string" ? raw.replace(/[\u0000-\u0008\u000b-\u001f\u007f]+/g, " ").trim() : "";
  if (!text) return { ok: false, error: "Write a message first." };
  if (text.length > CHAT_MAX) return { ok: false, error: `Keep messages under ${CHAT_MAX} characters.` };
  return { ok: true, value: text };
}

export interface ChatSession {
  sharer: string;
  learner: string;
  account: string; // who this token speaks for: the sharer or the learner
  exp: number;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const mac = (secret: string, body: string) => createHmac("sha256", `portwell-chat-v1:${secret}`).update(body).digest("base64url");

export function makeToken(secret: string, s: ChatSession): string {
  const body = b64(JSON.stringify(s));
  return `${body}.${mac(secret, body)}`;
}

export function readToken(secret: string, token: unknown, now: number): ChatSession | null {
  if (typeof token !== "string" || token.length > 600) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(mac(secret, body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ChatSession;
    if (typeof s.exp !== "number" || s.exp < now) return null;
    if (![s.sharer, s.learner, s.account].every((x) => typeof x === "string")) return null;
    if (s.account !== s.sharer && s.account !== s.learner) return null;
    return s;
  } catch {
    return null;
  }
}

export const roleOf = (s: ChatSession): "learner" | "sharer" => (s.account === s.sharer ? "sharer" : "learner");
