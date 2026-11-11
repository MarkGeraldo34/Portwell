import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { decide, scanPost, type RiskInput } from "@/lib/risk";
import { aiReview } from "@/lib/ai-review";
import { hashPost, normalizePost, type PostInput } from "@/lib/post-format";
import { verifyProof, type Proof } from "@/lib/publish-auth";
import { realDeps } from "@/server/access";
import { blobConfigured, blobProblem, listCards, savePost } from "@/server/blob-store";

const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 6;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) return NextResponse.json({ error: "Too many requests. Wait a minute." }, { status: 429 });

  const body = (await req.json().catch(() => null)) as { post?: PostInput; auth?: Proof } | null;
  if (!body?.post || !body.auth) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  // 1. Everything is validated again here. The browser's checks are only for convenience.
  const norm = normalizePost(body.post);
  if (!norm.ok) return NextResponse.json({ error: norm.error }, { status: 400 });
  const post = norm.value;

  // 2. The wallet must have signed exactly this content.
  let proof;
  try {
    proof = await verifyProof(body.auth, "publish", realDeps, await hashPost(post));
  } catch {
    return NextResponse.json({ error: "Could not verify your wallet right now. Try again." }, { status: 503 });
  }
  if (!proof.ok) return NextResponse.json({ error: proof.error }, { status: proof.status });

  // 3. The scam review is mandatory: rules plus AI. If the AI cannot run, nothing is published.
  const input: RiskInput = {
    title: post.title,
    summary: post.summary,
    steps: [...post.steps, ...post.media.filter((m) => !m.upload).map((m) => `Media link: ${m.url}`)],
    risks: post.risks,
    risk: post.risk,
    capitalNeededNear: post.capitalNeededNear,
  };
  const rules = scanPost(input);
  const ai = await aiReview(input);
  const { final, approved } = decide(rules.verdict, ai);
  if (!ai.available) {
    return NextResponse.json({ error: "The AI scam review is required and is unavailable right now, so nothing was published.", final, ai }, { status: 503 });
  }
  if (!approved) {
    const why = [...rules.findings.map((f) => f.message), ...(ai.reasons ?? [])][0];
    return NextResponse.json({ error: `The scam review blocked this post${why ? `: ${why}` : ""}.`, final, ai }, { status: 422 });
  }

  // Storage is checked last so the scam review always runs, whether or not storage is ready.
  if (!blobConfigured()) {
    return NextResponse.json({ error: `The post passed the scam review, but ${blobProblem()}, so it was not saved.` }, { status: 503 });
  }
  const card = await savePost(proof.accountId, post);
  revalidatePath("/");
  revalidatePath(`/sharers/${proof.accountId}`);
  return NextResponse.json({ id: card.id, final });
}

/** Public list of a sharer's published cards (used to unlock the price form for returning sharers). */
export async function GET(req: Request) {
  const sharer = new URL(req.url).searchParams.get("sharer") ?? "";
  if (!/^[a-z0-9._-]{2,64}$/.test(sharer) || !blobConfigured()) return NextResponse.json({ posts: [] });
  try {
    return NextResponse.json({ posts: (await listCards()).filter((c) => c.sharer === sharer).map((c) => c.id) });
  } catch {
    return NextResponse.json({ posts: [] });
  }
}
