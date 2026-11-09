"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CONTRACT_CONFIGURED } from "@/lib/config";
import { getStats, listSubscriptionsFor } from "@/lib/contract";
import { buildRows, mostReputable, mostSubscribed, type Row, type StatLite } from "@/lib/leaderboard";

const short = (a: string) => (a.length > 26 ? `${a.slice(0, 12)}…${a.slice(-10)}` : a);
const MEDAL = ["#f5c542", "#c0c7d4", "#cd7f32"];

function Crown({ rank }: { rank: number }) {
  if (rank > 3) return <span className="rank-num">{rank}</span>;
  return (
    <svg className="rank-medal" width="26" height="26" viewBox="0 0 24 24" fill={MEDAL[rank - 1]} stroke="none" aria-label={`Rank ${rank}`}>
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
    </svg>
  );
}

export function Leaderboard({ known }: { known: string[] }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"subscribed" | "reputable">("subscribed");

  useEffect(() => {
    if (!CONTRACT_CONFIGURED) {
      setRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const subs = await listSubscriptionsFor("", { includeAll: true });
      const names = Array.from(new Set([...known, ...subs.map((s) => s.sharer)]));
      const stats: Record<string, StatLite | null> = {};
      await Promise.all(names.map(async (n) => (stats[n] = await getStats(n).catch(() => null))));
      if (!cancelled) setRows(buildRows(subs, stats, known));
    })().catch((e) => {
      if (!cancelled) {
        setErr(e instanceof Error ? e.message : "Could not load");
        setRows([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [known]);

  const ranked = rows ? (tab === "subscribed" ? mostSubscribed(rows) : mostReputable(rows)) : [];

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Leaderboard type">
        <button role="tab" aria-selected={tab === "subscribed"} className={tab === "subscribed" ? "tab on" : "tab"} onClick={() => setTab("subscribed")}>
          Most subscribed
        </button>
        <button role="tab" aria-selected={tab === "reputable"} className={tab === "reputable" ? "tab on" : "tab"} onClick={() => setTab("reputable")}>
          Most reputable
        </button>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: "4px 0 10px" }}>
        {tab === "subscribed"
          ? "Ranked by how many learners have subscribed."
          : "Ranked by reputation, weighted by how many subscriptions it is based on, so one clean subscription does not beat a long good record."}
      </p>

      {rows === null && <p className="muted">Loading leaderboard…</p>}
      {err && <p className="muted">Could not load the leaderboard right now ({err}).</p>}
      {rows?.length === 0 && !err && <p className="muted">No sharers to rank yet.</p>}

      <ol className="board">
        {ranked.map((r, i) => (
          <li key={r.sharer} className={`post board-row${i < 3 ? " top" : ""}`}>
            <Crown rank={i + 1} />
            <div className="board-who">
              <Link href={`/sharers/${r.sharer}`} title={r.sharer}>@{short(r.sharer)}</Link>
              <span className="muted">
                {r.disputes} dispute{r.disputes === 1 ? "" : "s"} · {r.refunds} refund{r.refunds === 1 ? "" : "s"}
              </span>
            </div>
            <div className="board-num">
              <b>{r.subscriptions}</b>
              <span>subs</span>
            </div>
            <div className="board-num rep">
              <b>{r.score === null ? "New" : r.score}</b>
              <span>reputation</span>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
