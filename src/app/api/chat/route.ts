import { NextResponse } from "next/server";
import { readToken, roleOf, validateChatText } from "@/lib/chat";
import { scanPost } from "@/lib/risk";
import { blobConfigured, chatSecret, listChatMessages, saveChatMessage } from "@/server/blob-store";

const hits = new Map<string, number[]>();
function limited(key: string, max: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}

/** New messages since a timestamp. The page polls this every few seconds while the chat is open. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const s = readToken(chatSecret(), url.searchParams.get("token"), Date.now());
  if (!s || !blobConfigured()) return NextResponse.json({ error: "Chat session expired. Reopen the chat." }, { status: 401 });
  if (limited(`g:${s.account}`, 60)) return NextResponse.json({ error: "Slow down a little." }, { status: 429 });
  const since = Number(url.searchParams.get("since")) || 0;
  try {
    return NextResponse.json({ messages: await listChatMessages(s.sharer, s.learner, since), you: roleOf(s) });
  } catch {
    return NextResponse.json({ error: "Could not load messages right now." }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { token?: string; text?: string } | null;
  const s = readToken(chatSecret(), b?.token, Date.now());
  if (!s || !blobConfigured()) return NextResponse.json({ error: "Chat session expired. Reopen the chat." }, { status: 401 });
  if (limited(`p:${s.account}`, 20)) return NextResponse.json({ error: "You are sending messages too fast." }, { status: 429 });
  const t = validateChatText(b?.text);
  if (!t.ok) return NextResponse.json({ error: t.error }, { status: 400 });
  // The same rules scanner as posts, so the chat cannot be used to ask for seed phrases or push scams.
  const rules = scanPost({ title: "chat message", summary: t.value, steps: [], risks: "", risk: "low", capitalNeededNear: 0 });
  if (rules.verdict === "block") {
    return NextResponse.json({ error: `Message not sent: ${rules.findings[0]?.message ?? "it looks like a scam"}.` }, { status: 422 });
  }
  try {
    const saved = await saveChatMessage(s.sharer, s.learner, roleOf(s), t.value);
    return NextResponse.json({ ok: true, ts: saved.ts });
  } catch {
    return NextResponse.json({ error: "Could not send right now. Try again." }, { status: 503 });
  }
}
