"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "./WalletProvider";
import { CHAT_MAX, type ChatMessage } from "@/lib/chat";
import { proofMessage, RECIPIENT } from "@/lib/proof-message";

const clock = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/**
 * Private chat between the learner and the sharer of an active subscription. The wallet signs once to open it
 * (free), then messages flow over short polling, so replies show up within a few seconds.
 */
export function ChatBox({ sharer, learner }: { sharer: string; learner: string }) {
  const { accountId, signMessage } = useWallet();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const since = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);
  const me: "learner" | "sharer" = accountId === sharer ? "sharer" : "learner";
  const other = me === "sharer" ? learner : sharer;

  const say = (t: string, isBad = false) => {
    setNote(t);
    setBad(isBad);
  };

  async function start() {
    setOpen(true);
    if (token) return;
    setBusy(true);
    say("Waiting for your wallet to sign. This is free and sends no transaction.");
    try {
      const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(32)));
      const message = proofMessage("chat", accountId!, Date.now(), `${sharer}|${learner}`);
      const s = await signMessage({ message, recipient: RECIPIENT, nonce });
      const auth = { accountId: s.accountId, publicKey: s.publicKey, signature: s.signature, message, nonce: nonce.toString("base64") };
      const res = await fetch("/api/chat/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sharer, learner, auth }) });
      const j = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!res.ok || !j.token) throw new Error(j.error ?? "Could not open the chat.");
      setToken(j.token);
      say("");
    } catch (e) {
      say(e instanceof Error ? e.message : "Could not open the chat.", true);
    } finally {
      setBusy(false);
    }
  }

  // Poll for new messages every 3 seconds while the chat is open and the tab is visible.
  useEffect(() => {
    if (!open || !token) return;
    let live = true;
    async function pull() {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/chat?token=${encodeURIComponent(token!)}&since=${since.current}`, { cache: "no-store" });
        const j = (await res.json().catch(() => ({}))) as { messages?: ChatMessage[]; error?: string };
        if (!live) return;
        if (res.status === 401) {
          setToken(null);
          say("The chat session ended. Press Chat again to reopen it.", true);
          return;
        }
        if (res.ok && j.messages && j.messages.length > 0) {
          since.current = Math.max(since.current, ...j.messages.map((m) => m.ts));
          setMsgs((cur) => {
            const have = new Set(cur.map((m) => m.ts + m.from));
            return [...cur, ...j.messages!.filter((m) => !have.has(m.ts + m.from))];
          });
        }
      } catch {
        /* try again on the next tick */
      }
    }
    void pull();
    const t = setInterval(() => void pull(), 3000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [open, token]);

  useEffect(() => bottom.current?.scrollIntoView({ block: "nearest" }), [msgs.length]);

  async function send() {
    if (!token || !text.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, text }) });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (res.status === 401) setToken(null);
        return say(j.error ?? "Could not send.", true);
      }
      setText("");
      say("");
    } finally {
      setBusy(false);
    }
  }

  if (!accountId || (accountId !== sharer && accountId !== learner)) return null;

  if (!open) {
    return (
      <button className="chat-open" onClick={() => void start()}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z" />
        </svg>
        Chat with {me === "sharer" ? "your learner" : "the sharer"}
      </button>
    );
  }
  return (
    <section className="chat" aria-label={`Chat with ${other}`}>
      <header className="chat-head">
        <span className="chat-dot" aria-hidden="true" />
        <b>{other}</b>
        <span className="chat-sub">{me === "sharer" ? "your learner" : "your sharer"} · private</span>
        <button className="chat-x" onClick={() => setOpen(false)} aria-label="Close chat">×</button>
      </header>
      <div className="chat-log" role="log" aria-live="polite">
        {msgs.length === 0 && token && <p className="chat-empty">No messages yet. Ask a question about the strategy or answer one.</p>}
        {msgs.map((m) => (
          <div key={`${m.ts}${m.from}`} className={`chat-msg${m.from === me ? " mine" : ""}`}>
            <span>{m.text}</span>
            <time>{clock(m.ts)}</time>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      {note && <p className={bad ? "ai-msg" : "muted"} role={bad ? "alert" : "status"} style={{ margin: "6px 12px 0", fontSize: 13 }}>{note}</p>}
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input value={text} maxLength={CHAT_MAX} disabled={!token || busy} placeholder={token ? "Write a message…" : "Opening chat…"} onChange={(e) => setText(e.target.value)} aria-label="Message" />
        <button className="btn" disabled={!token || busy || !text.trim()}>Send</button>
      </form>
    </section>
  );
}
