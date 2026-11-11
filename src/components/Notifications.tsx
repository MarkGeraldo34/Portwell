"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "./WalletProvider";
import { CONTRACT_CONFIGURED } from "@/lib/config";
import { formatNear, getOwner, listSubscriptionsFor } from "@/lib/contract";
import { loadBoard } from "@/lib/social";
import { buildNotifications, type Note, type NoteKind } from "@/lib/notifications";

const FILTERS: { id: "all" | NoteKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "offer", label: "Offers" },
  { id: "subscription", label: "Subscriptions" },
  { id: "refund", label: "Refunds" },
  { id: "dispute", label: "Disputes" },
];

const ICON: Record<NoteKind, string> = {
  offer: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  subscription: "M20 12V8H6a2 2 0 0 1 0-4h12v4M4 6v12a2 2 0 0 0 2 2h14v-4M18 12a2 2 0 0 0 0 4h4v-4z",
  refund: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
  dispute: "M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
};

const ago = (ts: number) => {
  if (!ts) return "";
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};

export function Notifications() {
  const { accountId, signIn } = useWallet();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<"all" | NoteKind>("all");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setErr("");
    try {
      const owner = CONTRACT_CONFIGURED ? await getOwner().catch(() => null) : null;
      const isOwner = owner === accountId;
      const [subs, board] = await Promise.all([
        CONTRACT_CONFIGURED ? listSubscriptionsFor(accountId, { includeAll: isOwner }) : Promise.resolve([]),
        loadBoard(50).catch(() => []),
      ]);
      setNotes(
        buildNotifications(
          accountId,
          subs,
          board.map(({ request, offers }) => ({ request, offers })),
          isOwner,
          (y) => formatNear(y, 2),
        ),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load notifications");
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!accountId) {
    return (
      <section className="card">
        <p className="muted">Connect your wallet to see offers on your requests, subscriptions, refunds and disputes.</p>
        <button className="btn" onClick={signIn}>Connect wallet</button>
      </section>
    );
  }

  const shown = (notes ?? []).filter((n) => filter === "all" || n.kind === filter);

  return (
    <>
      <div className="row">
        <div className="tabs" role="tablist">
          {FILTERS.map((f) => (
            <button key={f.id} role="tab" aria-selected={filter === f.id} className={filter === f.id ? "tab on" : "tab"} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <button className={`icon-btn${loading ? " spin" : ""}`} disabled={loading} onClick={() => void load()} aria-label="Refresh" title="Refresh">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />
          </svg>
        </button>
      </div>
      {err && <p className="ai-msg" role="alert">Could not load everything: {err}</p>}
      {notes === null && <p className="muted">Loading…</p>}
      {notes && shown.length === 0 && !err && <p className="muted">Nothing here yet.</p>}
      <ul className="notes">
        {shown.map((n) => {
          const body = (
            <>
              <span className={`note-ico note-${n.kind}`} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICON[n.kind]} /></svg>
              </span>
              <span className="note-body">
                <b>{n.title}</b>
                <span>{n.detail}</span>
              </span>
              <span className="note-time">{ago(n.ts)}</span>
            </>
          );
          return (
            <li key={n.id} className="note">
              {n.href ? <Link href={n.href}>{body}</Link> : <div>{body}</div>}
            </li>
          );
        })}
      </ul>
    </>
  );
}
