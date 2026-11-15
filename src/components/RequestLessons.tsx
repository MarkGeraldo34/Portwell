"use client";

import { useCallback, useEffect, useState } from "react";
import { AccountLink } from "./AccountLink";
import { useWallet } from "./WalletProvider";
import { CONTRACT_CONFIGURED } from "@/lib/config";
import { listSubscriptionsFor } from "@/lib/contract";
import { LESSON_LIMITS, type Lesson } from "@/lib/lessons";
import { proofMessage, RECIPIENT } from "@/lib/proof-message";

const when = (ts: number) => new Date(ts).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * The working space of one request, on its "View and subscribe" page. After the learner subscribes, the sharer
 * posts the lessons here and the learner reads them here. One wallet signature (free) opens it for an hour.
 */
export function RequestLessons({ learner, requestId, sharer, offerTs }: { learner: string; requestId: string; sharer: string; offerTs: number }) {
  const { accountId, signMessage } = useWallet();
  const me = accountId === sharer ? "sharer" : accountId === learner ? "learner" : null;
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [f, setF] = useState({ title: "", body: "" });
  const [note, setNote] = useState("");
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);

  const say = (t: string, isBad = false) => {
    setNote(t);
    setBad(isBad);
  };

  // Lessons exist only once this learner has an Active subscription made through this offer.
  useEffect(() => {
    setSubscribed(null);
    if (!me || !CONTRACT_CONFIGURED) return;
    let live = true;
    listSubscriptionsFor(accountId!)
      .then((subs) => live && setSubscribed(subs.some((x) => x.learner === learner && x.sharer === sharer && x.status === "Active" && Number(BigInt(x.start_ns) / 1_000_000n) >= offerTs)))
      .catch(() => live && setSubscribed(false));
    return () => {
      live = false;
    };
  }, [me, accountId, learner, sharer, offerTs]);

  const pull = useCallback(
    async (t: string) => {
      const res = await fetch(`/api/lessons?token=${encodeURIComponent(t)}&request=${encodeURIComponent(requestId)}`, { cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as { lessons?: Lesson[]; error?: string };
      if (res.status === 401) {
        setToken(null);
        say("Your session ended. Press Open lessons again.", true);
        return;
      }
      if (res.ok && j.lessons) setLessons(j.lessons);
    },
    [requestId],
  );

  async function open() {
    setBusy(true);
    say("Waiting for your wallet to sign. This is free and sends no transaction.");
    try {
      const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(32)));
      const message = proofMessage("chat", accountId!, Date.now(), `${sharer}|${learner}`);
      const s = await signMessage({ message, recipient: RECIPIENT, nonce });
      const auth = { accountId: s.accountId, publicKey: s.publicKey, signature: s.signature, message, nonce: nonce.toString("base64") };
      const res = await fetch("/api/chat/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sharer, learner, auth }) });
      const j = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!res.ok || !j.token) throw new Error(j.error ?? "Could not open the lessons.");
      setToken(j.token);
      say("");
      await pull(j.token);
    } catch (e) {
      say(e instanceof Error ? e.message : "Could not open the lessons.", true);
    } finally {
      setBusy(false);
    }
  }

  // New lessons show up on their own while the page is open.
  useEffect(() => {
    if (!token) return;
    const t = setInterval(() => {
      if (!document.hidden) void pull(token);
    }, 20_000);
    return () => clearInterval(t);
  }, [token, pull]);

  async function post() {
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch("/api/lessons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, request: requestId, title: f.title, body: f.body }) });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (res.status === 401) setToken(null);
        return say(j.error ?? "Could not post the lesson.", true);
      }
      setF({ title: "", body: "" });
      say("Lesson posted. Your learner can read it now.");
      await pull(token);
    } finally {
      setBusy(false);
    }
  }

  if (!me) return null;

  return (
    <section className="card lessons" aria-label="Lessons">
      <h3>{me === "sharer" ? "Your lessons for this request" : "Your lessons"}</h3>
      {subscribed === null && <p className="muted">Checking the subscription…</p>}
      {subscribed === false && (
        <p className="muted" style={{ margin: 0 }}>
          {me === "learner"
            ? <>Subscribe above and the lessons from <AccountLink account={sharer} /> will appear here.</>
            : <>Lessons open here once <AccountLink account={learner} /> subscribes to your offer.</>}
        </p>
      )}
      {subscribed && !token && (
        <>
          <p className="muted" style={{ margin: "0 0 10px" }}>
            {me === "sharer" ? "Post the lessons for this request here. Only your learner can read them." : <>Lessons posted by <AccountLink account={sharer} /> for this request appear here. Only you can read them.</>}
          </p>
          <button className="btn" disabled={busy} onClick={() => void open()}>{busy ? "Opening…" : "Open lessons"}</button>
        </>
      )}
      {note && <p className={bad ? "ai-msg" : "muted"} role={bad ? "alert" : "status"} style={{ fontSize: 13 }}>{note}</p>}

      {subscribed && token && me === "sharer" && (
        <form
          className="lesson-form"
          onSubmit={(e) => {
            e.preventDefault();
            void post();
          }}
        >
          <input value={f.title} maxLength={LESSON_LIMITS.title} placeholder="Lesson title, for example Week 1: set up your wallet" onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="Lesson title" />
          <textarea rows={5} value={f.body} maxLength={LESSON_LIMITS.body} placeholder="Write the lesson for your learner…" onChange={(e) => setF({ ...f, body: e.target.value })} aria-label="Lesson" />
          <button className="btn" disabled={busy || !f.title.trim() || !f.body.trim()}>{busy ? "Posting…" : "Post lesson"}</button>
        </form>
      )}

      {subscribed && token && (
        <>
          <h4 className="lesson-count">{lessons ? `${lessons.length} ${lessons.length === 1 ? "lesson" : "lessons"}` : "Loading lessons…"}</h4>
          {lessons && lessons.length === 0 && (
            <p className="muted" style={{ margin: 0 }}>{me === "sharer" ? "No lessons yet. Post the first one above." : "No lessons yet. Your sharer has 24 hours after you subscribe to start posting."}</p>
          )}
          <ul className="lesson-list">
            {lessons?.map((l) => (
              <li key={l.ts}>
                <div className="lesson-head">
                  <b>{l.title}</b>
                  <time>{when(l.ts)}</time>
                </div>
                <p>{l.body}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
