"use client";

import { useCallback, useEffect, useState } from "react";
import { AccountLink } from "./AccountLink";
import { useWallet } from "./WalletProvider";
import { ReleaseTimeline, maturedWeeks } from "./ReleaseTimeline";
import { formatNear, getOwner, getSubscription, listSubscriptionsFor, type SubscriptionView } from "@/lib/contract";

type Act = { method: "release_due" | "cancel" | "dispute" } | { method: "resolve_dispute"; favorLearner: boolean };

/** Settled subscriptions mark everything as processed, so show the outcome instead of "released x of x". */
function progress(sub: SubscriptionView): string {
  const total = `${formatNear(sub.total)} NEAR`;
  switch (sub.status) {
    case "Completed":
      return `Paid out in full: ${total} released to the sharer`;
    case "Cancelled":
      return `Settled on cancel: matured weeks paid to the sharer, the rest refunded (${total} total)`;
    case "Resolved":
      return `Settled by the owner: unreleased funds went to one side (${total} total)`;
    case "Disputed":
      return `Releases paused: ${formatNear(sub.total)} NEAR held until the owner resolves`;
    default:
      return `Released ${formatNear(sub.released)} of ${total}`;
  }
}

/** True once 24 hours have passed since the subscription started. */
const pastDay = (sub: SubscriptionView) => Date.now() - Number(BigInt(sub.start_ns) / 1_000_000n) >= 24 * 3600 * 1000;

function Row({
  sub,
  me,
  isOwner,
  onAct,
}: {
  sub: SubscriptionView;
  me: string;
  isOwner: boolean;
  onAct: (a: Act, id: string) => void;
}) {
  const isLearner = sub.learner === me;
  const open = sub.status === "Active";
  return (
    <div className={`card sub-card${open ? " is-active" : " is-settled"}`}>
      <div className="sub-head">
        <strong>Subscription #{sub.id}</strong>
        <span className={`tag status-${sub.status.toLowerCase()}`}>{sub.status}</span>
      </div>
      <p className="sub-parties">
        <AccountLink account={sub.learner} full />
        <span className="arrow" aria-hidden="true">→</span>
        <AccountLink account={sub.sharer} full />
      </p>
      <p className="sub-progress">{progress(sub)}</p>
      <ReleaseTimeline sub={sub} />
      {open && (isLearner || sub.sharer === me) && (
        <p className="offer-prompt" role="note">
          {isLearner ? (
            <>
              The sharer has 24 hours from your subscription to start posting. If they do not start sharing after 24 hours, click the Refund button
              {pastDay(sub) ? " below." : " (under More actions)."}
            </>
          ) : (
            <>You have 24 hours from this subscription to start sharing. If you do not start posting after 24 hours, the learner will click Refund and get their unreleased payment back.</>
          )}
          {isLearner && pastDay(sub) && (
            <span style={{ display: "block", marginTop: 8 }}>
              <button className="btn" onClick={() => onAct({ method: "cancel" }, sub.id)}>Refund</button>
            </span>
          )}
        </p>
      )}
      {open && (
        <span className="row">
          {sub.sharer === me && (
            <button
              className="btn"
              disabled={maturedWeeks(sub) * 1 <= 0 || BigInt(sub.total) * BigInt(maturedWeeks(sub)) / 4n <= BigInt(sub.released)}
              title="Collect the weekly parts that have matured"
              onClick={() => onAct({ method: "release_due" }, sub.id)}
            >
              Claim matured weeks
            </button>
          )}
          {isLearner && (
            <details className="more-actions">
              <summary>More actions</summary>
              <div className="more-menu">
                <button className="btn ghost muted-act" title="Cancel and get unreleased weeks refunded" onClick={() => onAct({ method: "cancel" }, sub.id)}>
                  Refund (cancel)
                </button>
                <button className="btn ghost muted-act" title="Pause releases and ask the owner to decide" onClick={() => onAct({ method: "dispute" }, sub.id)}>
                  Dispute
                </button>
              </div>
            </details>
          )}
        </span>
      )}
      {isOwner && sub.status === "Disputed" && (
        <span className="row">
          <button className="btn" onClick={() => onAct({ method: "resolve_dispute", favorLearner: true }, sub.id)}>
            Resolve: refund learner
          </button>
          <button className="btn ghost" onClick={() => onAct({ method: "resolve_dispute", favorLearner: false }, sub.id)}>
            Resolve: pay sharer
          </button>
        </span>
      )}
    </div>
  );
}

export function SubscriptionActions() {
  const { accountId, call, signIn } = useWallet();
  const [subs, setSubs] = useState<SubscriptionView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [owner, setOwner] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [byId, setById] = useState<SubscriptionView | null>(null); // a subscription found by id that is not in your list

  const refresh = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const o = await getOwner().catch(() => null);
      setOwner(o);
      setSubs(await listSubscriptionsFor(accountId, { includeAll: o === accountId }));
      setMsg("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not load subscriptions");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const q = query.trim().toLowerCase();
  useEffect(() => {
    setById(null);
    if (!/^\d{1,9}$/.test(q)) return;
    let live = true;
    void getSubscription(Number(q)).then((r) => live && setById(r)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [q]);

  async function act(a: Act, id: string) {
    setMsg("Waiting for wallet approval…");
    try {
      const args = a.method === "resolve_dispute" ? { id: Number(id), favor_learner: a.favorLearner } : { id: Number(id) };
      await call(a.method, args);
      setMsg(`${a.method} sent. Refreshing…`);
      setTimeout(() => void refresh(), 3000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Transaction failed");
    }
  }

  if (!accountId) {
    return (
      <section className="card">
        <p>Connect your wallet to see your subscriptions.</p>
        <button className="btn" onClick={signIn}>
          Connect wallet
        </button>
      </section>
    );
  }

  const matches = (x: SubscriptionView) => !q || x.id === q || x.sharer.toLowerCase().includes(q) || x.learner.toLowerCase().includes(q);
  const found = (subs ?? []).filter(matches);
  if (byId && !found.some((x) => x.id === byId.id)) found.unshift(byId);
  const active = found.filter((x) => x.status === "Active");
  const inactive = found.filter((x) => x.status !== "Active");
  const isOwner = owner === accountId;
  const card = (x: SubscriptionView) => <Row key={x.id} sub={x} me={accountId} isOwner={isOwner} onAct={(a, id) => void act(a, id)} />;

  return (
    <>
      <div className="sub-search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by sharer name or subscription ID"
          aria-label="Search subscriptions by sharer name or subscription ID"
        />
      </div>
      <section>
        <div className="row">
          <h3 style={{ margin: 0 }}>{isOwner ? "All subscriptions (you are the owner)" : `Subscriptions for ${accountId}`}</h3>
          <button className={`icon-btn${loading ? " spin" : ""}`} disabled={loading} onClick={() => void refresh()} aria-label="Refresh" title="Refresh">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>
        {subs && subs.length === 0 && !q && <p className="muted">None found for this account yet. A new subscription can take a few seconds to appear, so press the refresh icon.</p>}
        {q && found.length === 0 && <p className="muted">No subscription matches “{query.trim()}”.</p>}
        {active.map(card)}
        {!q && subs && subs.length > 0 && active.length === 0 && <p className="muted">No active subscriptions.</p>}
        {inactive.length > 0 && (
          <details className="inactive-cards" open={!!q || (isOwner && inactive.some((x) => x.status === "Disputed"))}>
            <summary>Inactive cards ({inactive.length})</summary>
            <p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>Resolved, disputed, cancelled (refunded) and fully paid subscriptions.</p>
            {inactive.map(card)}
          </details>
        )}
      </section>
      {msg && <p role="status">{msg}</p>}
    </>
  );
}
