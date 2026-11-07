import { NextResponse } from "next/server";
import { scanPost, stricter, type RiskInput } from "@/lib/risk";
import { aiReview } from "@/lib/ai-review";

// Tiny in-memory limiter so a public endpoint cannot burn AI credits. Per server instance only.
const hits = new Map<string, number[]>();
const LIMIT = 10;
const WINDOW_MS = 60_000;

function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > LIMIT;
}

function parse(body: unknown): RiskInput | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : null);
  const title = str(b.title, 120);
  const summary = str(b.summary, 1000);
  const risks = str(b.risks, 1000);
  if (title === null || summary === null || risks === null) return null;
  if (!Array.isArray(b.steps) || b.steps.length > 12) return null;
  const steps = b.steps.map((s) => str(s, 300));
  if (steps.some((s) => s === null)) return null;
  const risk = b.risk === "low" || b.risk === "medium" || b.risk === "high" ? b.risk : null;
  const capital = typeof b.capitalNeededNear === "number" && b.capitalNeededNear >= 0 ? b.capitalNeededNear : null;
  if (!risk || capital === null) return null;
  return { title, summary, steps: steps as string[], risks, risk, capitalNeededNear: capital };
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const post = parse(await req.json().catch(() => null));
  if (!post) return NextResponse.json({ error: "Invalid post" }, { status: 400 });

  const rules = scanPost(post);
  const ai = await aiReview(post);
  // The AI may only raise the verdict. A post cannot talk its way to "ok".
  const final = ai.available && ai.verdict ? stricter(rules.verdict, ai.verdict) : rules.verdict;
  return NextResponse.json({ rules, ai, final });
}
