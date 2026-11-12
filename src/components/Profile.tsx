"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "./WalletProvider";
import { FeedPosts, type FeedPost } from "./FeedPosts";
import { loadBoard } from "@/lib/social";

interface Req {
  id: string;
  title: string;
  details: string;
  budget: number;
  ts: number;
  offers: number;
}

const day = (ts: number) => (ts ? new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

/** Simple public profile: who this wallet is, what it shares, and what it asked for. */
export function Profile({ account }: { account: string }) {
  const { accountId } = useWallet();
  const me = accountId === account;
  const [shares, setShares] = useState<FeedPost[] | null>(null);
  const [requests, setRequests] = useState<Req[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    setShares(null);
    setRequests(null);
    fetch(`/api/posts?sharer=${encodeURIComponent(account)}&cards=1`)
      .then((r) => r.json())
      .then((j: { cards?: FeedPost[] }) => live && setShares(j.cards ?? []))
      .catch(() => live && setShares([]));
    loadBoard(50)
      .then((board) => {
        if (!live) return;
        setRequests(
          board
            .filter((b) => b.request.learner === account)
            .map((b) => ({ id: b.request.id, title: b.request.title, details: b.request.details, budget: b.request.budget, ts: b.request.ts, offers: b.offers.length })),
        );
      })
      .catch(() => live && setRequests([]));
    return () => {
      live = false;
    };
  }, [account]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  }

  return (
    <div className="profile">
      <section className="card profile-hero">
        <span className="profile-avatar" aria-hidden="true">{account[0]?.toUpperCase()}</span>
        <div className="profile-who">
          <h1 className="profile-id">
            {account}
            {me && <span className="you-chip">you</span>}
          </h1>
          <div className="profile-stats">
            <span><b>{shares ? shares.length : "–"}</b> shares</span>
            <span><b>{requests ? requests.length : "–"}</b> requests</span>
          </div>
        </div>
        <button className="btn ghost" onClick={() => void copy()}>{copied ? "Copied" : "Copy ID"}</button>
      </section>

      <h2 className="board-title">Shares</h2>
      {shares === null && <p className="muted">Loading…</p>}
      {shares && shares.length === 0 && (
        <p className="muted">
          {me ? "You have not shared a strategy yet. " : "No shared strategies yet. "}
          {me && <Link href="/share">Share post</Link>}
        </p>
      )}
      {shares && shares.length > 0 && <FeedPosts posts={shares} />}

      <h2 className="board-title">Requests</h2>
      {requests === null && <p className="muted">Loading…</p>}
      {requests && requests.length === 0 && (
        <p className="muted">
          {me ? "You have not requested a strategy yet. " : "No requests yet. "}
          {me && <Link href="/request-strategy">Request strategy</Link>}
        </p>
      )}
      {requests?.map((r) => (
        <article key={r.id} className="card profile-req">
          <div className="row">
            <strong>{r.title}</strong>
            <span className="chip">{r.budget} NEAR</span>
          </div>
          {r.details && <p className="muted" style={{ margin: "6px 0 0" }}>{r.details}</p>}
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
            {day(r.ts)} · {r.offers} {r.offers === 1 ? "offer" : "offers"}
          </p>
        </article>
      ))}
    </div>
  );
}
