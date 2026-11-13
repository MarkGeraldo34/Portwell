import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { decide, scanPost, type RiskInput } from "@/lib/risk";
import { aiReview } from "@/lib/ai-review";
import { hashUpdate, validateUpdate, type UpdateInput } from "@/lib/update-format";
import { verifyProof, type Proof } from "@/lib/publish-auth";
import { isAccountId } from "@/lib/unlock";
import { realDeps } from "@/server/access";
import { blobConfigured, blobProblem, saveUpdate, updateTimes } from "@/server/blob-store";
import { cardsBySharer } from "@/server/posts";

export const maxDuration = 60; // the AI review can take a while

const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 8;
}

/** Post an update to your own strategy. Same rules as a post: signed by your wallet, and the scam review is mandatory. */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) return NextResponse.json({ error: "Too many requests. Wait a minute." }, { status: 429 });

  const body = (await req.json().catch(() => null)) as { update?: UpdateInput; auth?: Proof } | null;
  if (!body?.update || !body.auth) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const norm = validateUpdate(body.update);
  if (!norm.ok) return NextResponse.json({ error: norm.error }, { status: 400 });
  const update = norm.value;

  let proof;
  try {
    proof = await verifyProof(body.auth, "update", realDeps, await hashUpdate(update));
  } catch {
    return NextResponse.json({ error: "Could not verify your wallet right now. Try again." }, { status: 503 });
  }
  if (!proof.ok) return NextResponse.json({ error: proof.error }, { status: proof.status });

  // The update must belong to one of the signer's own posts.
  if (!blobConfigured()) return NextResponse.json({ error: `Updates cannot be saved: ${blobProblem()}.` }, { status: 503 });
  const mine = await cardsBySharer(proof.accountId);
  if (!mine.some((c) => c.id === update.postId)) return NextResponse.json({ error: "You can only update your own posts." }, { status: 403 });

  const input: RiskInput = { title: update.title, summary: update.body, steps: [], risks: "Follow-up update to subscribers", risk: "low", capitalNeededNear: 0 };
  const rules = scanPost(input);
  const ai = await aiReview(input);
  const { final, approved } = decide(rules.verdict, ai);
  if (!ai.available) return NextResponse.json({ error: "The AI scam review is required and is unavailable right now, so nothing was posted.", final, ai }, { status: 503 });
  if (!approved) {
    const why = [...rules.findings.map((f) => f.message), ...(ai.reasons ?? [])][0];
    return NextResponse.json({ error: `The scam review blocked this update${why ? `: ${why}` : ""}.`, final, ai }, { status: 422 });
  }

  const saved = await saveUpdate(proof.accountId, update);
  revalidatePath(`/sharers/${proof.accountId}`);
  return NextResponse.json({ ok: true, ts: saved.ts });
}

/** When a sharer posted their updates (no content). Subscribers' pages use it to show weekly progress. */
export async function GET(req: Request) {
  const sharer = new URL(req.url).searchParams.get("sharer");
  if (!isAccountId(sharer)) return NextResponse.json({ error: "Invalid sharer" }, { status: 400 });
  if (!blobConfigured()) return NextResponse.json({ times: [] });
  try {
    return NextResponse.json({ times: await updateTimes(sharer) });
  } catch {
    return NextResponse.json({ times: [] });
  }
}
