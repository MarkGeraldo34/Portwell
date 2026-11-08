"use client";

import { useEffect, useState } from "react";
import { useWallet } from "./WalletProvider";
import { formatNear, getPrice, getStats, type SharerStats } from "@/lib/contract";

export function SubscribePanel({ sharer }: { sharer: string }) {
  const { accountId, call, signIn } = useWallet();
  const [price, setPrice] = useState<string | null | undefined>(undefined);
  const [stats, setStats] = useState<SharerStats | null>(null);
  const [msg, setMsg] = useState("");
  const [loadError, setLoadError] = useState("");

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
    if (!price) return;
    setMsg("Waiting for wallet approval…");
    try {
      await call("subscribe", { sharer }, BigInt(price));
      setMsg("Sent. Funds are held in escrow and released weekly. Open My subscriptions and press Refresh to see it.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Transaction failed");
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
          <button className="btn" onClick={() => void subscribe()}>
            Subscribe
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
