"use client";

import { useEffect, useState } from "react";
import { useWallet } from "./WalletProvider";
import { formatNear, getPrice, getStats, listSubscriptionsFor, type SharerStats } from "@/lib/contract";

export function SubscribePanel({ sharer }: { sharer: string }) {
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
      {price &&
        (accountId ? (
          <button className="btn" onClick={() => void subscribe()} disabled={subscribed || sending} style={subscribed || sending ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
            {subscribed ? "Subscribed ✓" : sending ? "Subscribing…" : "Subscribe"}
          </button>
        ) : (
          <button className="btn" onClick={signIn}>
            Connect wallet to subscribe
          </button>
        ))}
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}
