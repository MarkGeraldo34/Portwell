"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "./WalletProvider";
import { FeedPosts, type FeedPost } from "./FeedPosts";
import { PaginationSummary } from "./ListTools";
import { loadBoard } from "@/lib/social";
import { CONTRACT_CONFIGURED } from "@/lib/config";
import { getStats, listSubscriptionsFor } from "@/lib/contract";
import { buildRows, type Row } from "@/lib/leaderboard";
import { formatDuration } from "@/lib/duration";
import { learnerActivity, learnerReputation, reputation, type Score } from "@/lib/reputation";

interface Req {
  id: string;
  title: string;
  details: string;
  budget: number;
  duration: string;
  ts: number;
  offers: number;
}

const day = (ts: number) => (ts ? new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

const tone = (v: number) => (v >= 80 ? "good" : v >= 50 ? "mid" : "low");

function RepTile({ label, score }: { label: string; score: Score | null }) {
  const text = score === null ? "–" : score.kind === "new" ? "New" : `${score.value}`;
  const cls = score?.kind === "scored" ? `rep-tile ${tone(score.value)}` : "rep-tile";
  return (
    <div className={cls} title="Site reputation, worked out from on-chain subscriptions, disputes and refunds">
      <b>{text}{score?.kind === "scored" && <small> / 100</small>}</b>
      <span>{label}</span>
    </div>
  );
}

/** Simple public profile: who this wallet is, what it shares, and what it asked for. */
export function Profile({ account }: { account: string }) {
  const { accountId } = useWallet();
  const me = accountId === account;
  const [shares, setShares] = useState<FeedPost[] | null>(null);
  const [requests, setRequests] = useState<Req[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [overall, setOverall] = useState<Row | null>(null);
  // Site reputation: as a sharer (needs sharer-side subscriptions) and as a learner. null while loading.
  const [scores, setScores] = useState<{ sharer: Score; learner: Score } | null>(null);

  useEffect(() => {
    let live = true;
    setShares(null);
    setRequests(null);
    fetch(`/api/posts?sharer=${encodeURIComponent(account)}&cards=1`)
      .then((r) => r.json())
      .then((j: { cards?: FeedPost[] }) => live && setShares(j.cards ?? []))
      .catch(() => live && setShares([]));
    // The sharer's overall numbers (all their posts together) are shown here and on the leaderboard.
    setOverall(null);
    setScores(null);
    if (CONTRACT_CONFIGURED) {
      Promise.all([listSubscriptionsFor(account), getStats(account).catch(() => null)])
        .then(([subs, st]) => {
          if (!live) return;
          const row = buildRows(subs.filter((s) => s.sharer === account), { [account]: st }, [account])[0] ?? null;
          setOverall(row);
          setScores({
            sharer: row ? reputation({ subscriptions: row.subscriptions, disputes: row.disputes, refunds: row.refunds }) : { kind: "new" },
            learner: learnerReputation(learnerActivity(subs, account)),
          });
        })
        .catch(() => {});
    }
    loadBoard(50)
      .then((board) => {
        if (!live) return;
        setRequests(
          board
            .filter((b) => b.request.learner === account)
            .map((b) => ({ id: b.request.id, title: b.request.title, details: b.request.details, budget: b.request.budget, duration: b.request.duration ? formatDuration(b.request.duration) : "", ts: b.request.ts, offers: b.offers.length })),
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
            {overall && (
              <>
                <span><b>{overall.subscriptions}</b> subscriptions</span>
                <span><b>{overall.disputes}</b> disputes</span>
                <span><b>{overall.refunds}</b> refunds</span>
              </>
            )}
          </div>
        </div>
        <button className="btn ghost" onClick={() => void copy()}>{copied ? "Copied" : "Copy ID"}</button>
        <div className="rep-tiles" aria-label="Site reputation">
          <RepTile label="Reputation as sharer" score={scores?.sharer ?? null} />
          <RepTile label="Reputation as learner" score={scores?.learner ?? null} />
        </div>
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
            <span className="chip">{r.budget} NEAR{r.duration ? ` for ${r.duration}` : ""}</span>
          </div>
          {r.details && <p className="muted" style={{ margin: "6px 0 0" }}>{r.details}</p>}
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
            {day(r.ts)} · {r.offers} {r.offers === 1 ? "offer" : "offers"}
          </p>
        </article>
      ))}
      {requests !== null && <PaginationSummary paged={{ page: 1, pageCount: 1, from: requests.length ? 1 : 0, to: requests.length, total: requests.length }} noun={requests.length === 1 ? "request" : "requests"} />}
    </div>
  );
}
