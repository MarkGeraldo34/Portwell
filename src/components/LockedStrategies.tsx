"use client";

import { useState, type ReactNode } from "react";
import { Buffer } from "buffer";
import { useWallet } from "./WalletProvider";
import { VerdictTag } from "./RiskPanel";
import { SealedSubscribe } from "./SubscribePanel";
import type { Verdict } from "@/lib/risk";
import { APP, RECIPIENT } from "@/lib/unlock";

interface Teaser {
  id: string;
  title: string;
  summary: string;
  risk: string;
  capitalNeededNear: number;
  steps: number;
  verdict: Verdict;
}
interface Detail {
  id: string;
  steps: string[];
  risks: string;
  proofWallet: string | null;
}

export function LockedStrategies({ sharer, teasers, media = {} }: { sharer: string; teasers: Teaser[]; media?: Record<string, ReactNode> }) {
  const { accountId, signIn, signMessage } = useWallet();
  const [details, setDetails] = useState<Detail[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function unlock() {
    if (!accountId) return signIn();
    setBusy(true);
    setMsg("Waiting for the wallet to sign. This costs nothing and sends no transaction.");
    try {
      const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(32)));
      const message = JSON.stringify({ app: APP, sharer, iat: Date.now() });
      const signed = await signMessage({ message, recipient: RECIPIENT, nonce });
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sharer,
          accountId: signed.accountId,
          publicKey: signed.publicKey,
          signature: signed.signature,
          message,
          nonce: nonce.toString("base64"),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not unlock");
      setDetails(json.details);
      setMsg("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not unlock");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {teasers.map((t) => {
        const d = details?.find((x) => x.id === t.id);
        return (
          <article className={`post risk-${t.risk}`} key={t.id}>
            <div className="post-top">
              <h3>{t.title}</h3>
              <VerdictTag verdict={t.verdict} />
            </div>
            <p className="post-meta">
              <span>{t.risk} risk</span>
              <span className="dot">•</span>
              <span>{t.capitalNeededNear} NEAR to start</span>
            </p>
            <p style={{ margin: "0 0 10px", fontSize: "14.5px" }}>{t.summary}</p>
            {media[t.id]}
            {d ? (
              <>
                <ol>
                  {d.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p>
                  <strong>Risk ({t.risk}):</strong> {d.risks}
                </p>
                <p className="muted">
                  Proof wallet: {d.proofWallet ?? "none linked yet — treat unverified posts with extra care"}
                </p>
              </>
            ) : (
              <div className="sealed" aria-label={`${t.steps} steps, risk notes and proof wallet are sealed until you subscribe`}>
                <span className="sealed-bars" aria-hidden="true"><i /><i /><i /></span>
                <span className="sealed-label">{t.steps} steps · risk notes · proof wallet <b>sealed until you subscribe</b></span>
                <SealedSubscribe />
              </div>
            )}
          </article>
        );
      })}
      {!details && (
        <div className="card unlock-card">
          <span className="unlock-kicker">Sealed content</span>
          <p style={{ margin: "6px 0 12px" }}>
            Steps, risk notes and the proof wallet are shown only to active subscribers. Subscribe above, then sign with your wallet to open them.
          </p>
          <button className="btn" onClick={unlock} disabled={busy}>
            {accountId ? "Unlock with wallet" : "Connect wallet to unlock"}
          </button>
          {msg && <p className="muted">{msg}</p>}
        </div>
      )}
    </>
  );
}
