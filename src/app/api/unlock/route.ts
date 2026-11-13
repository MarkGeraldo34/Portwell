import { NextResponse } from "next/server";
import { authorize, isAccountId, type UnlockRequest } from "@/lib/unlock";
import { realDeps } from "@/server/access";
import { cardsBySharer, detailsForSharerPosts } from "@/server/posts";
import { blobConfigured, readUpdates } from "@/server/blob-store";

// Small in-memory limiter. Each request makes several RPC calls, so keep it modest. Per instance only.
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 20;
}

const str = (v: unknown, max: number) => (typeof v === "string" && v.length <= max ? v : null);

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const body: UnlockRequest | null =
    b &&
    isAccountId(b.sharer) &&
    isAccountId(b.accountId) &&
    str(b.publicKey, 100) &&
    str(b.signature, 200) &&
    str(b.message, 300) &&
    str(b.nonce, 100)
      ? (b as unknown as UnlockRequest)
      : null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if ((await cardsBySharer(body.sharer)).length === 0) return NextResponse.json({ error: "Unknown sharer" }, { status: 404 });

  let decision;
  try {
    decision = await authorize(body, realDeps);
  } catch {
    return NextResponse.json({ error: "Could not verify right now. Try again." }, { status: 503 });
  }
  if (!decision.ok) return NextResponse.json({ error: decision.error }, { status: decision.status });

  const updates = blobConfigured() ? await readUpdates(body.sharer).catch(() => []) : [];
  return NextResponse.json({ reason: decision.reason, details: await detailsForSharerPosts(body.sharer), updates });
}
