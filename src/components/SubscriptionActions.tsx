"use client";

import { useState } from "react";
import { useWallet } from "./WalletProvider";
import { formatNear, getSubscription, type SubscriptionView } from "@/lib/contract";

export function SubscriptionActions() {
  const { accountId, call } = useWallet();
  const [id, setId] = useState("0");
  const [sub, setSub] = useState<SubscriptionView | null | undefined>(undefined);
  const [msg, setMsg] = useState("");

  async function lookup() {
    setMsg("");
    try {
      setSub(await getSubscription(Number(id)));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lookup failed");
    }
  }

  async function act(method: "release_due" | "cancel" | "dispute") {
    setMsg("Waiting for wallet approval…");
    try {
      await call(method, { id: Number(id) });
      setMsg(`${method} sent.`);
      await lookup();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Transaction failed");
    }
  }

  return (
    <section className="card">
      <h3>Look up a subscription</h3>
      <label>
        Subscription id
        <input value={id} onChange={(e) => setId(e.target.value)} inputMode="numeric" />
      </label>
      <button className="btn" onClick={() => void lookup()}>
        Look up
      </button>
      {sub === null && <p>No subscription with that id.</p>}
      {sub && (
        <>
          <p>
            {sub.learner} → {sub.sharer} · {sub.status}
            <br />
            Released {formatNear(sub.released)} of {formatNear(sub.total)} NEAR
          </p>
          {accountId && (
            <span className="row">
              <button className="btn" onClick={() => void act("release_due")}>
                Release due
              </button>
              <button className="btn ghost" onClick={() => void act("cancel")}>
                Cancel (learner)
              </button>
              <button className="btn ghost" onClick={() => void act("dispute")}>
                Dispute (learner)
              </button>
            </span>
          )}
        </>
      )}
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}
