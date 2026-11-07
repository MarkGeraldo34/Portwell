"use client";

import { useState } from "react";
import { useWallet } from "./WalletProvider";
import { parseNear } from "@/lib/contract";

export function SetPriceForm() {
  const { accountId, call } = useWallet();
  const [near, setNear] = useState("1");
  const [msg, setMsg] = useState("");
  if (!accountId) return null;

  async function submit() {
    setMsg("Waiting for wallet approval…");
    try {
      await call("set_price", { price: parseNear(near).toString() });
      setMsg("Price saved. It applies to new subscriptions only.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Transaction failed");
    }
  }

  return (
    <section className="card">
      <h3>Set your monthly price (sharers)</h3>
      <label>
        NEAR per month (minimum 0.1)
        <input value={near} onChange={(e) => setNear(e.target.value)} inputMode="decimal" />
      </label>
      <button className="btn" onClick={() => void submit()}>
        Save price
      </button>
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}
