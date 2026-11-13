"use client";

import { useEffect, useState } from "react";
import { Buffer } from "buffer";
import { useWallet } from "./WalletProvider";
import { proofMessage, RECIPIENT } from "@/lib/proof-message";
import { validateHandle } from "@/lib/post-format";

/**
 * Proves the sharer owns their X account. The site gives a short code tied to their NEAR account, they post it from
 * that X account, paste the tweet link, and the server checks the tweet. Used for strategy posts and offers to teach.
 * Reports the verified handle (or null) through onChange.
 */
export function VerifyX({ onChange }: { onChange: (handle: string | null) => void }) {
  const { accountId, signIn, signMessage } = useWallet();
  const [verified, setVerified] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [handle, setHandle] = useState("");
  const [challenge, setChallenge] = useState<{ code: string; text: string; handle: string } | null>(null);
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const say = (t: string, isBad = false) => {
    setMsg(t);
    setBad(isBad);
  };

  useEffect(() => {
    setVerified(null);
    onChange(null);
    setChallenge(null);
    if (!accountId) return setLoading(false);
    let live = true;
    setLoading(true);
    fetch(`/api/x-verify?accounts=${encodeURIComponent(accountId)}`)
      .then((r) => (r.ok ? r.json() : { verified: {} }))
      .then((j: { verified?: Record<string, string> }) => {
        const h = j.verified?.[accountId] ?? null;
        if (!live) return;
        setVerified(h);
        onChange(h);
      })
      .catch(() => {})
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  async function getCode() {
    if (!accountId) return signIn();
    const h = validateHandle(handle);
    if (!h.ok) return say(h.error, true);
    setBusy(true);
    say("");
    try {
      const res = await fetch(`/api/x-verify?account=${encodeURIComponent(accountId)}&handle=${encodeURIComponent(h.value)}`);
      const j = (await res.json().catch(() => ({}))) as { code?: string; text?: string; error?: string };
      if (!res.ok || !j.code || !j.text) return say(j.error ?? "Could not get a code. Try again.", true);
      setChallenge({ code: j.code, text: j.text, handle: h.value });
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    if (!accountId || !challenge) return;
    if (!url.trim()) return say("Paste the link to your tweet first.", true);
    setBusy(true);
    say("Waiting for your wallet to sign. This is free and sends no transaction.");
    try {
      const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(32)));
      const message = proofMessage("xverify", accountId, Date.now(), `${challenge.handle.toLowerCase()}|${url.trim()}`);
      const s = await signMessage({ message, recipient: RECIPIENT, nonce });
      const auth = { accountId: s.accountId, publicKey: s.publicKey, signature: s.signature, message, nonce: nonce.toString("base64") };
      say("Reading your tweet…");
      const res = await fetch("/api/x-verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle: challenge.handle, url: url.trim(), auth }) });
      const j = (await res.json().catch(() => ({}))) as { handle?: string; error?: string };
      if (!res.ok || !j.handle) return say(j.error ?? "Could not verify. Try again.", true);
      setVerified(j.handle);
      onChange(j.handle);
      setChallenge(null);
      setChanging(false);
      setUrl("");
      say("");
    } catch (e) {
      say(e instanceof Error ? e.message : "Could not verify", true);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!challenge) return;
    try {
      await navigator.clipboard.writeText(challenge.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* the text is selectable, so people can copy by hand */
    }
  }

  if (!accountId) return <div className="xv"><b className="xv-title">X handle</b><p className="muted xv-hint">Connect your wallet to verify your X account.</p></div>;
  if (loading) return <div className="xv"><b className="xv-title">X handle</b><p className="muted xv-hint">Checking…</p></div>;

  if (verified && !changing) {
    return (
      <div className="xv ok">
        <b className="xv-title">X handle</b>
        <p className="xv-done">
          <span className="xv-tick" aria-hidden="true">✓</span> @{verified} <span className="muted">verified for {accountId}</span>
          <button type="button" className="xv-link" onClick={() => setChanging(true)}>Use another</button>
        </p>
      </div>
    );
  }

  return (
    <div className="xv">
      <b className="xv-title">Verify your X handle (required)</b>
      <p className="muted xv-hint">Anyone can type a handle, so prove it is yours: get a code, post it from that X account, then paste the tweet link.</p>

      <div className="xv-step">
        <span className="xv-num">1</span>
        <input value={handle} maxLength={16} placeholder="@yourhandle" onChange={(e) => { setHandle(e.target.value); setChallenge(null); }} aria-label="Your X handle" />
        <button type="button" className="btn ghost" disabled={busy} onClick={() => void getCode()}>Get my code</button>
      </div>

      {challenge && (
        <>
          <div className="xv-step col">
            <span className="xv-num">2</span>
            <div className="xv-code">
              <code>{challenge.code}</code>
              <span className="muted">Post this from @{challenge.handle}:</span>
              <q>{challenge.text}</q>
              <span className="xv-actions">
                <button type="button" className="btn ghost" onClick={() => void copy()}>{copied ? "Copied" : "Copy text"}</button>
                <a className="btn ghost" href={`https://x.com/intent/post?text=${encodeURIComponent(challenge.text)}`} target="_blank" rel="noopener noreferrer">Post on X ↗</a>
              </span>
            </div>
          </div>
          <div className="xv-step">
            <span className="xv-num">3</span>
            <input value={url} maxLength={300} placeholder="Paste the tweet link (https://x.com/…/status/…)" onChange={(e) => setUrl(e.target.value)} aria-label="Link to your tweet" />
            <button type="button" className="btn" disabled={busy} onClick={() => void check()}>Verify</button>
          </div>
        </>
      )}
      {msg && <p className={bad ? "ai-msg" : "muted xv-hint"} role={bad ? "alert" : "status"}>{msg}</p>}
      {changing && <button type="button" className="xv-link" onClick={() => { setChanging(false); setChallenge(null); }}>Keep @{verified}</button>}
    </div>
  );
}
