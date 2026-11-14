import { NextResponse } from "next/server";
import { isAccountId } from "@/lib/unlock";
import { chatIncoming } from "@/server/blob-store";

const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 40;
}

/** GET ?account=<id> -> who has messaged this account and when. No message text, just names and times, for the unread badges. */
export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) return NextResponse.json({ incoming: [] }, { status: 429 });
  const account = new URL(req.url).searchParams.get("account") ?? "";
  if (!isAccountId(account)) return NextResponse.json({ incoming: [] });
  try {
    return NextResponse.json({ incoming: await chatIncoming(account) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ incoming: [] });
  }
}
