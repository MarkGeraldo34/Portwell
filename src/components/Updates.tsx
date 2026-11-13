"use client";

import { useEffect, useState } from "react";
import { useWallet } from "./WalletProvider";
import { requireAiApproval } from "@/lib/ai-gate";
import { proofMessage, RECIPIENT } from "@/lib/proof-message";
import { cadence, hashUpdate, UPDATE_LIMITS, validateUpdate } from "@/lib/update-format";
import type { SubscriptionView } from "@/lib/contract";

export interface UpdateItem {
  postId: string;
  title: string;
  body: string;
  ts: number;
}

const when = (ts: number) => new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** How many updates the sharer has posted (public), so a learner can see the sharer keeps going. */
export function UpdateCount({ sharer }: { sharer: string }) {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/updates?sharer=${encodeURIComponent(sharer)}`)
      .then((r) => r.json())
      .then((j: { times?: number[] }) => live && setN(j.times?.length ?? 0))
      .catch(() => live && setN(null));
    return () => {
      live = false;
    };
  }, [sharer]);
  if (n === null) return null;
  return <span className="duration-chip">{n} {n === 1 ? "update" : "updates"} posted</span>;
}

/** The unlocked updates, newest first. Only subscribers (and the sharer) ever receive these. */
export function UpdatesList({ updates }: { updates: UpdateItem[] }) {
  if (updates.length === 0) return <p className="muted">No updates yet. The sharer posts follow-ups here every week of your subscription.</p>;
  return (
    <ul className="updates">
      {updates.map((u) => (
        <li key={`${u.postId}-${u.ts}`}>
          <b>{u.title}</b>
          <span className="muted"> · {when(u.ts)}</span>
          <p>{u.body}</p>
        </li>
      ))}
    </ul>
  );
}

/** Shown only to the sharer on their own post. Free to post: the wallet signs the text, no transaction. */
export function UpdateForm({ sharer, postId, onPosted }: { sharer: string; postId: string; onPosted: () => void }) {
  const { accountId, signMessage } = useWallet();
  const [f, setF] = useState({ title: "", body: "" });
  const [msg, setMsg] = useState("");
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  if (accountId !== sharer) return null;

  const say = (t: string, isBad = false) => {
    setMsg(t);
    setBad(isBad);
  };

  async function post() {
    const v = validateUpdate({ postId, ...f });
    if (!v.ok) return say(v.error, true);
    setBusy(true);
    try {
      say("Running the AI scam review…");
      const blocked = await requireAiApproval({ title: v.value.title, summary: v.value.body, steps: [], risks: "Follow-up update to subscribers", risk: "low", capitalNeededNear: 0 });
      if (blocked) return say(blocked, true);
      say("Waiting for your wallet to sign. This is free and sends no transaction.");
      const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(32)));
      const message = proofMessage("update", sharer, Date.now(), await hashUpdate(v.value));
      const s = await signMessage({ message, recipient: RECIPIENT, nonce });
      const auth = { accountId: s.accountId, publicKey: s.publicKey, signature: s.signature, message, nonce: nonce.toString("base64") };
      say("Posting…");
      const res = await fetch("/api/updates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ update: v.value, auth }) });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return say(j.error ?? "Could not post the update.", true);
      setF({ title: "", body: "" });
      say("Update posted. Your subscribers can see it now.");
      onPosted();
    } catch (e) {
      say(e instanceof Error ? e.message : "Could not post the update.", true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card update-form">
      <span className="unlock-kicker">Keep sharing</span>
      <p className="muted" style={{ margin: "6px 0 10px" }}>
        Payments are released to you week by week. Post an update for each remaining week of every subscription, so your learners keep getting what they paid for.
      </p>
      <label className="field">
        Update title
        <input value={f.title} maxLength={UPDATE_LIMITS.title} placeholder="e.g. Week 2: moving from staking to lending" onChange={(e) => setF({ ...f, title: e.target.value })} />
      </label>
      <label className="field">
        What is new this week
        <textarea rows={4} value={f.body} maxLength={UPDATE_LIMITS.body} placeholder="New steps, changes, results, answers to learners' questions." onChange={(e) => setF({ ...f, body: e.target.value })} />
      </label>
      <button className="btn" disabled={busy} onClick={() => void post()}>{busy ? "Working…" : "Post update"}</button>
      {msg && <p className={bad ? "ai-msg" : "muted"} role={bad ? "alert" : "status"} style={{ marginBottom: 0 }}>{msg}</p>}
    </section>
  );
}

/** On a subscription: how many weekly updates the sharer has posted since it started, against how many are due. */
export function UpdatesMeter({ sub, isLearner }: { sub: SubscriptionView; isLearner: boolean }) {
  const [times, setTimes] = useState<number[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/updates?sharer=${encodeURIComponent(sub.sharer)}`)
      .then((r) => r.json())
      .then((j: { times?: number[] }) => live && setTimes(j.times ?? []))
      .catch(() => live && setTimes(null));
    return () => {
      live = false;
    };
  }, [sub.sharer]);
  if (times === null) return null;
  const startMs = Number(BigInt(sub.start_ns) / 1_000_000n);
  const c = cadence(startMs, times, Date.now());
  const late = c.behind > 0;
  return (
    <p className={`updates-meter${late ? " late" : ""}`} role="note">
      Weekly updates since the subscription began: <b>{c.posted}</b> posted, <b>{c.owed}</b> due so far.
      {late && isLearner && <> The sharer is {c.behind} behind. If the updates stop, use Refund (More actions) or Dispute.</>}
      {late && !isLearner && <> You are {c.behind} update{c.behind === 1 ? "" : "s"} behind. Post {c.behind === 1 ? "it" : "them"} on your strategy page so the learner can see you are still sharing.</>}
      {!late && <> On track.</>}
    </p>
  );
}
