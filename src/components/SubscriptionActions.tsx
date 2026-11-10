"use client";

import { useCallback, useEffect, useState } from "react";
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
    <div className="card sub-card">
      <div className="sub-head">
        <strong>Subscription #{sub.id}</strong>
        <span className={`tag status-${sub.status.toLowerCase()}`}>{sub.status}</span>
      </div>
      <p className="sub-parties">
        <span title={sub.learner}>{sub.learner}</span>
        <span className="arrow" aria-hidden="true">→</span>
        <span title={sub.sharer}>{sub.sharer}</span>
      </p>
      <p className="sub-progress">{progress(sub)}</p>
      <ReleaseTimeline sub={sub} />
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
            <>
              <button className="btn ghost" onClick={() => onAct({ method: "cancel" }, sub.id)}>
                Cancel
              </button>
              <button className="btn ghost" onClick={() => onAct({ method: "dispute" }, sub.id)}>
                Dispute
              </button>
            </>
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
  const [lookupId, setLookupId] = useState("0");
  const [looked, setLooked] = useState<SubscriptionView | null | undefined>(undefined);

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

  return (
    <>
      <section>
        <div className="row">
          <h3 style={{ margin: 0 }}>{owner === accountId ? "All subscriptions (you are the owner)" : `Subscriptions for ${accountId}`}</h3>
          <button className={`icon-btn${loading ? " spin" : ""}`} disabled={loading} onClick={() => void refresh()} aria-label="Refresh" title="Refresh">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>
        {subs && subs.length === 0 && <p className="muted">None found for this account yet. A new subscription can take a few seconds to appear, so press the refresh icon.</p>}
        {subs?.map((s) => (
          <Row key={s.id} sub={s} me={accountId} isOwner={owner === accountId} onAct={(a, id) => void act(a, id)} />
        ))}
      </section>

      <section className="card">
        <h3>Look up any subscription by id</h3>
        <label>
          Subscription id
          <input value={lookupId} onChange={(e) => setLookupId(e.target.value)} inputMode="numeric" />
        </label>
        <button
          className="btn ghost"
          onClick={() => void getSubscription(Number(lookupId)).then(setLooked).catch(() => setLooked(null))}
        >
          Look up
        </button>
        {looked === null && <p>No subscription with that id.</p>}
        {looked && <Row sub={looked} me={accountId} isOwner={owner === accountId} onAct={(a, id) => void act(a, id)} />}
      </section>
      {msg && <p role="status">{msg}</p>}
    </>
  );
}
