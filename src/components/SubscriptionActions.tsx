"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "./WalletProvider";
import { formatNear, getSubscription, listSubscriptionsFor, type SubscriptionView } from "@/lib/contract";

type Method = "release_due" | "cancel" | "dispute";

function Row({ sub, me, onAct }: { sub: SubscriptionView; me: string; onAct: (m: Method, id: string) => void }) {
  const isLearner = sub.learner === me;
  const open = sub.status === "Active";
  return (
    <div className="card">
      <p>
        <strong>#{sub.id}</strong> · {sub.status}
        <br />
        {sub.learner} → {sub.sharer}
        <br />
        Released {formatNear(sub.released)} of {formatNear(sub.total)} NEAR
      </p>
      {open && (
        <span className="row">
          <button className="btn" onClick={() => onAct("release_due", sub.id)}>
            Release due
          </button>
          {isLearner && (
            <>
              <button className="btn ghost" onClick={() => onAct("cancel", sub.id)}>
                Cancel
              </button>
              <button className="btn ghost" onClick={() => onAct("dispute", sub.id)}>
                Dispute
              </button>
            </>
          )}
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
  const [lookupId, setLookupId] = useState("0");
  const [looked, setLooked] = useState<SubscriptionView | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      setSubs(await listSubscriptionsFor(accountId));
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

  async function act(method: Method, id: string) {
    setMsg("Waiting for wallet approval…");
    try {
      await call(method, { id: Number(id) });
      setMsg(`${method} sent. Refreshing…`);
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
          <h3 style={{ margin: 0 }}>Subscriptions for {accountId}</h3>
          <button className="btn ghost" disabled={loading} onClick={() => void refresh()}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
        {subs && subs.length === 0 && <p className="muted">None found for this account yet. A new subscription can take a few seconds to appear, so press Refresh.</p>}
        {subs?.map((s) => (
          <Row key={s.id} sub={s} me={accountId} onAct={(m, id) => void act(m, id)} />
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
        {looked && <Row sub={looked} me={accountId} onAct={(m, id) => void act(m, id)} />}
      </section>
      {msg && <p role="status">{msg}</p>}
    </>
  );
}
