"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useWallet } from "./WalletProvider";
import { formatNear, getPrice, getStats, listSubscriptionsFor, type SharerStats } from "@/lib/contract";

function useSubscribeState(sharer: string) {
  const { accountId, call, signIn } = useWallet();
  const [price, setPrice] = useState<string | null | undefined>(undefined);
  const [stats, setStats] = useState<SharerStats | null>(null);
  const [msg, setMsg] = useState("");
  const [loadError, setLoadError] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [sending, setSending] = useState(false);

  // Is the connected learner already actively subscribed to this sharer?
  useEffect(() => {
    setSubscribed(false);
    if (!accountId) return;
    let cancelled = false;
    listSubscriptionsFor(accountId)
      .then((subs) => {
        if (!cancelled) setSubscribed(subs.some((x) => x.learner === accountId && x.sharer === sharer && x.status === "Active"));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accountId, sharer]);

  useEffect(() => {
    getPrice(sharer)
      .then(setPrice)
      .catch((e: unknown) => {
        setPrice(null);
        setLoadError(e instanceof Error ? e.message : "Could not load the price");
      });
    getStats(sharer).then(setStats).catch(() => setStats(null));
  }, [sharer]);

  async function subscribe() {
    if (!price || sending || subscribed) return;
    setSending(true);
    setMsg("Waiting for wallet approval…");
    try {
      await call("subscribe", { sharer }, BigInt(price));
      setSubscribed(true);
      setMsg("Sent. Funds are held in escrow and released weekly. Open My subscriptions (the card icon at the top) and press the refresh icon to see it.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setSending(false);
    }
  }
  return { accountId, signIn, price, stats, msg, loadError, subscribed, sending, subscribe };
}

type SubState = ReturnType<typeof useSubscribeState>;
const Ctx = createContext<SubState | null>(null);

/** One subscription state shared by the Monthly subscription card and the button on each sealed post. */
export function SubscribeProvider({ sharer, children }: { sharer: string; children: ReactNode }) {
  const state = useSubscribeState(sharer);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useSubscribe = () => useContext(Ctx);

/** Subscribe button + status, for use inside the sealed post card. */
export function SealedSubscribe() {
  const sub = useSubscribe();
  if (!sub || !sub.price) return null;
  const { accountId, signIn, subscribed, sending, subscribe, msg } = sub;
  return (
    <div className="sealed-sub">
      {accountId ? (
        <button className="btn" onClick={() => void subscribe()} disabled={subscribed || sending} style={subscribed || sending ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
          {subscribed ? "Subscribed ✓" : sending ? "Subscribing…" : `Subscribe · ${formatNear(sub.price)} NEAR / 30 days`}
        </button>
      ) : (
        <button className="btn" onClick={signIn}>Connect wallet to subscribe</button>
      )}
      {msg && <p role="status" className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>{msg}</p>}
    </div>
  );
}

export function SubscribePanel() {
  const sub = useSubscribe();
  if (!sub) return null;
  const { price, stats, msg, loadError } = sub;

  return (
    <section className="card">
      <h3>Monthly subscription</h3>
      {price === undefined && <p>Loading price…</p>}
      {price === null && loadError && <p role="alert">Could not load the price: {loadError}</p>}
      {price === null && !loadError && <p>This sharer has not set a price yet.</p>}
      {price && (
        <p>
          <strong>{formatNear(price)} NEAR</strong> per 30 days, held in escrow and released in four weekly
          parts. Cancel any time to get the unreleased part back.
        </p>
      )}
      {stats && (
        <p className="muted">
          {stats.distinct_payers} distinct payers · {stats.renewals} renewals · {stats.disputes} disputes
        </p>
      )}
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}
