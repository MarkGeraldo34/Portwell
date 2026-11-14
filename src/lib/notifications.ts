import { isRefund } from "./leaderboard.ts";

// Pure builder for the notifications page (no network, easy to test).
// Events come from two places: the escrow contract (subscriptions, refunds, disputes) and Social DB (offers).
// The contract keeps no event log, so subscription-based items are dated by when the subscription started.

export type NoteKind = "offer" | "subscription" | "refund" | "dispute" | "chat";

export interface Note {
  id: string;
  kind: NoteKind;
  ts: number; // ms
  title: string;
  detail: string;
  href?: string;
}

export interface SubForNotes {
  id: string;
  learner: string;
  sharer: string;
  total: string;
  released: string;
  start_ns: string;
  status: string;
}

export interface RequestOffers {
  request: { id: string; title: string; learner: string };
  offers: { sharer: string; note: string; ts: number }[];
}

const startMs = (s: SubForNotes) => Math.floor(Number(BigInt(s.start_ns) / 1_000_000n));

export function buildNotifications(
  me: string,
  subs: SubForNotes[],
  board: RequestOffers[],
  isOwner: boolean,
  fmt: (yocto: bigint) => string,
  chats: { from: string; ts: number }[] = [],
): Note[] {
  const out: Note[] = [];

  // New chat messages: the newest one per conversation, written by the other person.
  for (const c of chats) {
    out.push({
      id: `chat-${c.from}`,
      kind: "chat",
      ts: c.ts,
      title: `New message from ${c.from}`,
      detail: "Open My subscriptions to read and reply",
      href: "/subscriptions",
    });
  }

  // Offers sharers made on requests I posted.
  for (const { request, offers } of board) {
    if (request.learner !== me) continue;
    for (const o of offers) {
      out.push({
        id: `offer-${request.id}-${o.sharer}`,
        kind: "offer",
        ts: o.ts,
        title: `${o.sharer} offered to teach you`,
        detail: `For your request “${request.title}”${o.note ? `: “${o.note}”` : ""}`,
        href: `/requests/${encodeURIComponent(request.learner)}/${request.id}?sharer=${encodeURIComponent(o.sharer)}`,
      });
    }
  }

  for (const s of subs) {
    const mine = s.learner === me || s.sharer === me;
    if (!mine && !isOwner) continue;
    const ts = startMs(s);
    const unreleased = BigInt(s.total) - BigInt(s.released);

    if (mine) {
      out.push({
        id: `sub-${s.id}`,
        kind: "subscription",
        ts,
        title: s.learner === me ? `You subscribed to ${s.sharer}` : `${s.learner} subscribed to you`,
        detail: `${fmt(BigInt(s.total))} NEAR for 30 days, held in escrow`,
        href: "/subscriptions",
      });
    }

    if (isRefund(s)) {
      out.push({
        id: `refund-${s.id}`,
        kind: "refund",
        ts,
        title: s.learner === me ? `You were refunded ${fmt(unreleased)} NEAR` : `${s.learner} was refunded ${fmt(unreleased)} NEAR`,
        detail: `Subscription #${s.id} with ${s.sharer} was ${s.status === "Cancelled" ? "cancelled" : "resolved for the learner"}`,
        href: "/subscriptions",
      });
    }

    if (s.status === "Disputed" || s.status === "Resolved") {
      const open = s.status === "Disputed";
      const who = s.learner === me ? "You" : s.learner;
      const against = s.sharer === me ? "you" : s.sharer;
      out.push({
        id: `dispute-${s.id}`,
        kind: "dispute",
        ts,
        title: open ? `${who} opened a dispute against ${against}` : `Dispute settled: ${s.learner} vs ${s.sharer}`,
        detail: open
          ? isOwner && !mine
            ? `Subscription #${s.id}. Needs your decision as contract owner.`
            : `Subscription #${s.id}. Releases are paused until the owner decides.`
          : `Subscription #${s.id} was resolved by the contract owner.`,
        href: "/subscriptions",
      });
    }
  }

  return out.sort((a, b) => b.ts - a.ts || a.id.localeCompare(b.id));
}
