import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { validateHandle } from "@/lib/post-format";
import { verifyProof, type Proof } from "@/lib/publish-auth";
import { isAccountId } from "@/lib/unlock";
import { challengeText, checkTweet, makeCode, parseTweetUrl, type Oembed } from "@/lib/x-verify";
import { realDeps } from "@/server/access";
import { blobConfigured, blobProblem, chatSecret, saveXVerified, xHandleOwner, xVerifiedFor } from "@/server/blob-store";

const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 8;
}

/**
 * GET ?account=<id>&handle=<x handle>  -> the code that account must tweet to claim that handle.
 * GET ?accounts=a,b,c                  -> which of those accounts have a verified X handle.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const list = q.get("accounts");
  if (list !== null) {
    const accounts = list.split(",").filter((a) => isAccountId(a)).slice(0, 60);
    return NextResponse.json({ verified: accounts.length ? await xVerifiedFor(accounts) : {} });
  }
  const account = q.get("account") ?? "";
  const handle = validateHandle(q.get("handle") ?? "");
  if (!isAccountId(account) || !handle.ok) return NextResponse.json({ error: handle.ok ? "Invalid account" : handle.error }, { status: 400 });
  if (!chatSecret()) return NextResponse.json({ error: "Verification is not available: CONTENT_SECRET is not set." }, { status: 503 });
  const code = makeCode(chatSecret(), account, handle.value);
  return NextResponse.json({ code, text: challengeText(code, account) });
}

/** Checks the tweet and, if it was posted by the claimed handle and carries the code, remembers the handle for this account. */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) return NextResponse.json({ error: "Too many attempts. Wait a minute." }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { handle?: string; url?: string; auth?: Proof } | null;
  if (!body || typeof body.handle !== "string" || typeof body.url !== "string" || !body.auth) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (!blobConfigured()) return NextResponse.json({ error: `Verification is not available: ${blobProblem()}.` }, { status: 503 });

  const handle = validateHandle(body.handle);
  if (!handle.ok) return NextResponse.json({ error: handle.error }, { status: 400 });
  const tweet = parseTweetUrl(body.url);
  if (!tweet) return NextResponse.json({ error: "Paste the link to your tweet, like https://x.com/yourhandle/status/123…" }, { status: 400 });
  if (tweet.handle.toLowerCase() !== handle.value.toLowerCase()) return NextResponse.json({ error: `That tweet is from @${tweet.handle}, not @${handle.value}.` }, { status: 400 });

  let proof;
  try {
    proof = await verifyProof(body.auth, "xverify", realDeps, `${handle.value.toLowerCase()}|${body.url}`);
  } catch {
    return NextResponse.json({ error: "Could not verify your wallet right now. Try again." }, { status: 503 });
  }
  if (!proof.ok) return NextResponse.json({ error: proof.error }, { status: proof.status });

  let oembed: Oembed;
  try {
    const res = await fetch(`https://publish.twitter.com/oembed?omit_script=1&url=${encodeURIComponent(tweet.canonical)}`, { signal: AbortSignal.timeout(8000), cache: "no-store", headers: { Accept: "application/json" } });
    if (res.status === 404 || res.status === 403) return NextResponse.json({ error: "X could not find that tweet. Check the link, and make sure the account is public." }, { status: 422 });
    if (!res.ok) throw new Error(String(res.status));
    oembed = (await res.json()) as Oembed;
  } catch {
    return NextResponse.json({ error: "Could not reach X to read the tweet right now. Try again in a minute." }, { status: 503 });
  }
  const checked = checkTweet(oembed, { handle: handle.value, code: makeCode(chatSecret(), proof.accountId, handle.value) });
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 422 });

  try {
    const owner = await xHandleOwner(handle.value);
    if (owner && owner !== proof.accountId) return NextResponse.json({ error: `@${handle.value} is already verified by another wallet.` }, { status: 409 });
    await saveXVerified(proof.accountId, { handle: handle.value, tweet: tweet.canonical, ts: Date.now() });
  } catch {
    return NextResponse.json({ error: "Verified, but the result could not be saved. Try again." }, { status: 503 });
  }
  revalidatePath("/");
  revalidatePath(`/sharers/${proof.accountId}`);
  return NextResponse.json({ handle: handle.value });
}
