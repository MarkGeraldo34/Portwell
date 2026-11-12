"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useWallet } from "./WalletProvider";
import { formatNear, getPrice, parseNear, getStats, listSubscriptionsFor, type SharerStats } from "@/lib/contract";

function useSubscribeState(sharer: string, expected?: number) {
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

  // When the page is for one post, the amount to pay must be that post's "Capital needed" exactly.
  const expectedYocto = expected === undefined ? null : parseNear(String(expected));
  const mismatch = !!price && expectedYocto !== null && BigInt(price) !== expectedYocto;

  async function subscribe() {
    if (!price || sending || subscribed || mismatch) return;
    setSending(true);
    setMsg("Waiting for wallet approval…");
    try {
      // Re-read the price right before paying: the deposit must equal the sharer's current price exactly.
      const current = await getPrice(sharer);
      if (!current) throw new Error("This sharer has no price set anymore.");
      if (expectedYocto !== null && BigInt(current) !== expectedYocto) throw new Error(`This post asks for ${expected} NEAR but the sharer's price is ${formatNear(current)} NEAR, so you cannot subscribe until the sharer updates it.`);
      if (current !== price) {
        setPrice(current);
        throw new Error(`The sharer changed their price to ${formatNear(current)} NEAR. Review it and press Subscribe again.`);
      }
      await call("subscribe", { sharer }, BigInt(current));
      setSubscribed(true);
      setMsg("Sent. Funds are held in escrow and released weekly. The sharer has 24 hours to start posting; if they do not start sharing after 24 hours, click Refund on your subscription. Open My subscriptions (the card icon at the top) and press the refresh icon to see it.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setSending(false);
    }
  }
  return { sharer, expected, mismatch, accountId, signIn, price, stats, msg, loadError, subscribed, sending, subscribe };
}

type SubState = ReturnType<typeof useSubscribeState>;
const Ctx = createContext<SubState | null>(null);

/** One subscription state shared by the Monthly subscription card and the button on each sealed post. */
export function SubscribeProvider({ sharer, expected, children }: { sharer: string; expected?: number; children: ReactNode }) {
  const state = useSubscribeState(sharer, expected);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useSubscribe = () => useContext(Ctx);

/** Subscribe button + status, for use inside the sealed post card. */
export function SealedSubscribe({ withAmount = false }: { withAmount?: boolean }) {
  const sub = useSubscribe();
  if (!sub || !sub.price) return null;
  // A sharer cannot subscribe to themselves, so they do not see the button on their own post.
  if (sub.accountId === sub.sharer) return null;
  const { accountId, signIn, subscribed, sending, subscribe, msg } = sub;
  if (sub.mismatch) {
    return (
      <div className="sealed-sub">
        <p className="ai-msg" role="alert">
          This post asks for {sub.expected} NEAR a month, but the sharer&apos;s current price is {formatNear(sub.price)} NEAR. You can subscribe once the sharer updates it to match.
        </p>
      </div>
    );
  }
  return (
    <div className="sealed-sub">
      {withAmount && (
        <p className="pay-line">
          You will pay <b>{formatNear(sub.price)} NEAR</b> for 30 days, held in escrow and released in four weekly parts.
        </p>
      )}
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
