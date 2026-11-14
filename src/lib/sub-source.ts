// Works out which post or request a subscription most likely came from.
// The contract keeps no post id, so this is a best guess from timing: the newest post by that sharer, or the
// offer the sharer made on that learner's request, that existed when the subscription started.

export interface SourcePost {
  id: string;
  sharer: string;
  title: string;
  ts: number; // ms
}
export interface SourceBoardItem {
  request: { id: string; title: string; learner: string };
  offers: { sharer: string; ts: number }[];
}
export interface SubSource {
  kind: "post" | "request";
  title: string;
  href: string;
}

const SLACK_MS = 60_000; // clocks differ a little between wallet, chain and storage

export function pickSource(
  sub: { sharer: string; learner: string; startMs: number },
  posts: SourcePost[],
  board: SourceBoardItem[],
): SubSource | null {
  const limit = sub.startMs + SLACK_MS;
  let best: (SubSource & { ts: number }) | null = null;
  const consider = (c: SubSource & { ts: number }) => {
    // Newer wins; on a tie the offer wins, because an offer is made for exactly one learner.
    if (!best || c.ts > best.ts || (c.ts === best.ts && c.kind === "request")) best = c;
  };
  for (const p of posts) {
    if (p.sharer === sub.sharer && p.ts <= limit) {
      consider({ kind: "post", title: p.title, ts: p.ts, href: `/sharers/${encodeURIComponent(p.sharer)}?post=${encodeURIComponent(p.id)}` });
    }
  }
  for (const { request, offers } of board) {
    if (request.learner !== sub.learner) continue;
    for (const o of offers) {
      if (o.sharer === sub.sharer && o.ts <= limit) {
        consider({
          kind: "request",
          title: request.title,
          ts: o.ts,
          href: `/requests/${encodeURIComponent(request.learner)}/${request.id}?sharer=${encodeURIComponent(sub.sharer)}`,
        });
      }
    }
  }
  if (!best) return null;
  const { kind, title, href } = best as SubSource & { ts: number };
  return { kind, title, href };
}
