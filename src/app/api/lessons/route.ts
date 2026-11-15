import { NextResponse } from "next/server";
import { readToken, roleOf } from "@/lib/chat";
import { isRequestId, validateLesson } from "@/lib/lessons";
import { scanPost } from "@/lib/risk";
import { blobConfigured, chatSecret, listLessons, saveLesson } from "@/server/blob-store";

const hits = new Map<string, number[]>();
function limited(key: string, max: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}

const EXPIRED = "Your session ended. Press Open lessons again.";

/** The lessons for one request. Needs the one-hour token from /api/chat/session, so only the learner and the sharer of an active subscription can read. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const s = readToken(chatSecret(), url.searchParams.get("token"), Date.now());
  const request = url.searchParams.get("request");
  if (!s || !blobConfigured()) return NextResponse.json({ error: EXPIRED }, { status: 401 });
  if (!isRequestId(request)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (limited(`g:${s.account}`, 30)) return NextResponse.json({ error: "Slow down a little." }, { status: 429 });
  try {
    return NextResponse.json({ lessons: await listLessons(s.sharer, s.learner, request), you: roleOf(s) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load lessons right now." }, { status: 503 });
  }
}

/** Only the sharer of the subscription can post a lesson. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { token?: string; request?: string; title?: string; body?: string } | null;
  const s = readToken(chatSecret(), b?.token, Date.now());
  if (!s || !blobConfigured()) return NextResponse.json({ error: EXPIRED }, { status: 401 });
  if (roleOf(s) !== "sharer") return NextResponse.json({ error: "Only the sharer can post lessons." }, { status: 403 });
  if (!isRequestId(b?.request)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (limited(`p:${s.account}`, 10)) return NextResponse.json({ error: "You are posting too fast." }, { status: 429 });
  const v = validateLesson({ title: b?.title, body: b?.body });
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  // Same rules scanner as posts and chat, so lessons cannot ask for seed phrases or push scams.
  const rules = scanPost({ title: v.value.title, summary: v.value.body, steps: [], risks: "", risk: "low", capitalNeededNear: 0 });
  if (rules.verdict === "block") return NextResponse.json({ error: `Lesson not posted: ${rules.findings[0]?.message ?? "it looks like a scam"}.` }, { status: 422 });
  try {
    const saved = await saveLesson(s.sharer, s.learner, b!.request as string, v.value);
    return NextResponse.json({ ok: true, ts: saved.ts });
  } catch {
    return NextResponse.json({ error: "Could not post right now. Try again." }, { status: 503 });
  }
}
