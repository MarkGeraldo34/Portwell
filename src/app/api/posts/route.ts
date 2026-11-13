import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { decide, scanPost, type RiskInput } from "@/lib/risk";
import { aiReview } from "@/lib/ai-review";
import { hashPost, normalizePost, type PostInput } from "@/lib/post-format";
import { verifyProof, type Proof } from "@/lib/publish-auth";
import { CONTRACT_CONFIGURED } from "@/lib/config";
import { listSubscriptionsFor } from "@/lib/contract";
import { postLocked } from "@/lib/delete-rules";
import { realDeps } from "@/server/access";
import { blobConfigured, blobProblem, deletePost, getXVerified, listCards, savePost } from "@/server/blob-store";

export const maxDuration = 60; // the AI review can take a while

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

  // 2b. The X handle on the post must be one this wallet has proven it owns (tweet challenge).
  if (blobConfigured()) {
    const xv = await getXVerified(proof.accountId);
    if (!xv || xv.handle.toLowerCase() !== post.xHandle.toLowerCase()) {
      return NextResponse.json({ error: `Verify @${post.xHandle} first: get your code, tweet it from that account and paste the link. Anyone can type a handle, so the site checks it.` }, { status: 403 });
    }
  }

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
    const mine = (await listCards()).filter((c) => c.sharer === sharer);
    // ?cards=1 returns the public card fields too (the same data the feed already shows). Steps and risks stay gated.
    if (new URL(req.url).searchParams.get("cards") === "1") {
      return NextResponse.json({ posts: mine.map((c) => c.id), cards: mine.map((c) => ({ id: c.id, sharer: c.sharer, title: c.title, xHandle: c.xHandle, email: c.email, duration: c.duration, mediaCount: c.media.length })) });
    }
    return NextResponse.json({ posts: mine.map((c) => c.id) });
  } catch {
    return NextResponse.json({ posts: [] });
  }
}

/** Delete one of your own posts. The wallet must sign the id of the post, and the post must belong to that account. */
export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: string; auth?: Proof } | null;
  if (!body?.id || typeof body.id !== "string" || !body.auth) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  let proof;
  try {
    proof = await verifyProof(body.auth, "delete", realDeps, body.id);
  } catch {
    return NextResponse.json({ error: "Could not verify your wallet right now. Try again." }, { status: 503 });
  }
  if (!proof.ok) return NextResponse.json({ error: proof.error }, { status: proof.status });
  // A post cannot be deleted while someone is subscribed to its sharer. Fail closed if the chain cannot be read.
  if (CONTRACT_CONFIGURED) {
    try {
      if (postLocked(await listSubscriptionsFor(proof.accountId), proof.accountId)) {
        return NextResponse.json({ error: "This post has an active subscriber, so it cannot be deleted until their subscription ends." }, { status: 409 });
      }
    } catch {
      return NextResponse.json({ error: "Could not check subscriptions right now, so nothing was deleted. Try again." }, { status: 503 });
    }
  }
  try {
    const result = await deletePost(body.id, proof.accountId);
    if (result === "forbidden") return NextResponse.json({ error: "Only the person who posted this can delete it." }, { status: 403 });
    if (result === "not_found") return NextResponse.json({ error: "That post no longer exists." }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Could not delete the post right now. Try again." }, { status: 503 });
  }
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
