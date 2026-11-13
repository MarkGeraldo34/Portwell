"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { getStats, listSubscriptionsFor } from "@/lib/contract";
import { buildRows } from "@/lib/leaderboard";
import { attributeToPosts } from "@/lib/post-stats";
import { CONTRACT_CONFIGURED } from "@/lib/config";
import { reputation } from "@/lib/reputation";
import type { Ethos } from "@/lib/ethos-types";
import { SharerLinks } from "./SharerLinks";
import { AccountLink } from "./AccountLink";
import { DeletePostButton } from "./DeleteButtons";
import { formatDuration, type Duration } from "@/lib/duration";
import { PaginationSummary, SearchBar, useListTools } from "./ListTools";

export interface FeedPost {
  id: string;
  sharer: string;
  title: string;
  xHandle?: string;
  verified?: boolean;
  email?: string;
  ethos?: Ethos;
  mediaCount?: number;
  duration?: Duration | null;
}

interface Numbers {
  subscriptions: number;
  disputes: number;
  refunds: number;
}

const short = (a: string) => (a.length > 28 ? `${a.slice(0, 14)}…${a.slice(-10)}` : a);

export function FeedPosts({ posts }: { posts: FeedPost[] }) {
  const [stats, setStats] = useState<Record<string, Numbers> | null>(null);
  const [overall, setOverall] = useState<Record<string, Numbers> | null>(null); // per sharer, for the reputation gauge only

  useEffect(() => {
    if (!CONTRACT_CONFIGURED) return;
    let cancelled = false;
    // Numbers on a card are for that post only; the sharer's overall numbers live on the leaderboard and the profile page.
    // The reputation gauge is the one exception: it shows the sharer's overall record, the same as the leaderboard.
    const sharers = Array.from(new Set(posts.map((p) => p.sharer)));
    Promise.all([listSubscriptionsFor("", { includeAll: true }), Promise.all(sharers.map((s) => getStats(s).catch(() => null)))])
      .then(([all, perSharer]) => {
        if (cancelled) return;
        setStats(attributeToPosts(all, posts));
        const st: Record<string, { subscriptions: number; disputes: number } | null> = {};
        sharers.forEach((s, i) => (st[s] = perSharer[i]));
        const rows = buildRows(all, st, sharers);
        setOverall(Object.fromEntries(rows.map((r) => [r.sharer, { subscriptions: r.subscriptions, disputes: r.disputes, refunds: r.refunds }])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [posts]);

  const tools = useListTools(posts, (p) => `${p.title} ${p.sharer} ${p.xHandle ?? ""}`, 6);
  return (
    <>
      <SearchBar value={tools.query} onChange={tools.setQuery} placeholder="Search by topic, strategy or sharer name" />
      {tools.searching && tools.filtered.length === 0 && <p className="muted">No strategies match “{tools.query.trim()}”.</p>}
      {tools.paged.slice.map((p) => (
        <Post key={p.id} post={p} n={stats?.[p.id]} overall={overall?.[p.sharer]} />
      ))}
      <PaginationSummary paged={tools.paged} noun={tools.paged.total === 1 ? "strategy" : "strategies"} onPage={tools.setPage} />
    </>
  );
}

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Gauge({ score }: { score: ReturnType<typeof reputation> | null }) {
  const id = useId();
  const R = 28;
  const C = 2 * Math.PI * R;
  const value = score?.kind === "scored" ? score.value : 0;
  const text = !score ? "–" : score.kind === "new" ? "New" : String(score.value);
  return (
    <div className="gauge" role="img" aria-label={`Reputation ${text}`}>
      <div className="gauge-ring">
      <svg viewBox="0 0 72 72" width="72" height="72">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#d92f54" />
            <stop offset=".55" stopColor="#3b78ff" />
            <stop offset="1" stopColor="#2fd6e8" />
          </linearGradient>
        </defs>
        <circle cx="36" cy="36" r={R} fill="none" stroke="rgba(255,255,255,.09)" strokeWidth="6" strokeDasharray={score?.kind === "scored" ? undefined : "3 6"} />
        {score?.kind === "scored" && (
          <circle cx="36" cy="36" r={R} fill="none" stroke={`url(#${id})`} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(C * value) / 100} ${C}`} transform="rotate(-90 36 36)" />
        )}
      </svg>
      <span className={score?.kind === "new" ? "gauge-num new" : "gauge-num"}>{text}</span>
      </div>
      <span className="gauge-label">reputation</span>
    </div>
  );
}

function Post({ post, n, overall }: { post: FeedPost; n?: Numbers; overall?: Numbers }) {
  // Only the reputation gauge uses the sharer's overall numbers; the three chips below are for this post alone.
  const rep = overall ? reputation(overall) : null;
  const v = (x?: number) => (n ? String(x) : "–");
  return (
    <article className="post">
      <div className="post-head">
        <span className="avatar" aria-hidden="true">{post.sharer[0]?.toUpperCase()}</span>
        <div className="post-id">
          <h3 className="post-title">{post.title}</h3>
          <span className="post-meta-id"><AccountLink account={post.sharer} /></span>
        </div>
        <Gauge score={rep} />
      </div>

      <ul className="chips">
        <li className="chip" title="Subscriptions">
          <svg width="16" height="16" viewBox="0 0 24 24" {...ICON} aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M21 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>
          <b>{v(n?.subscriptions)}</b> <span>subscriptions</span>
        </li>
        <li className={`chip${n && n.disputes > 0 ? " warn" : ""}`} title="Disputes">
          <svg width="16" height="16" viewBox="0 0 24 24" {...ICON} aria-hidden="true"><path d="M4 22V4M4 4h13l-2 4 2 4H4" /></svg>
          <b>{v(n?.disputes)}</b> <span>disputes</span>
        </li>
        <li className="chip" title="Refunds paid back to learners">
          <svg width="16" height="16" viewBox="0 0 24 24" {...ICON} aria-hidden="true"><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
          <b>{v(n?.refunds)}</b> <span>refunds</span>
        </li>
      </ul>

      <SharerLinks handle={post.xHandle} email={post.email} ethos={post.ethos} verified={post.verified} />

      <div className="post-foot">
        {post.duration && <span className="duration-chip">Shared for {formatDuration(post.duration)}</span>}
        {!!post.mediaCount && <span className="muted media-count">{post.mediaCount} media</span>}
        <DeletePostButton id={post.id} sharer={post.sharer} />
        <Link className="post-cta" href={`/sharers/${post.sharer}?post=${encodeURIComponent(post.id)}`}>
          View post →
        </Link>
      </div>
    </article>
  );
}
