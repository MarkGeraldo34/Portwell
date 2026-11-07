"use client";

import { useState } from "react";
import { RiskPanel, VerdictTag } from "./RiskPanel";
import type { RiskResult, Verdict } from "@/lib/risk";

interface ApiResult {
  rules: RiskResult;
  ai: { available: boolean; verdict?: Verdict; reasons?: string[]; error?: string };
  final: Verdict;
}

const SCAM_EXAMPLE = {
  title: "Double your NEAR in 7 days",
  summary: "Guaranteed 20% daily returns, risk-free. Act now, only 5 spots left! Bring friends into your downline.",
  steps: "Send me 10 NEAR to my wallet first\nEnter your seed phrase to verify your account",
  risks: "none",
};

export function PostChecker() {
  const [f, setF] = useState({ title: "", summary: "", steps: "", risks: "" });
  const [risk, setRisk] = useState<"low" | "medium" | "high">("medium");
  const [res, setRes] = useState<ApiResult | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          steps: f.steps.split("\n").map((s) => s.trim()).filter(Boolean),
          risk,
          capitalNeededNear: 1,
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `Error ${r.status}`);
      setRes(await r.json());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Check failed");
    } finally {
      setBusy(false);
    }
  }

  const field = (k: keyof typeof f, label: string, multi = false) => (
    <label>
      {label}
      {multi ? (
        <textarea value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} rows={3} />
      ) : (
        <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
      )}
    </label>
  );

  return (
    <section className="card">
      <h3>Check a strategy post (sharers)</h3>
      <p className="muted">
        Every post is scanned for scam patterns before it is shown. Blocked posts are hidden from learners.
      </p>
      {field("title", "Title")}
      {field("summary", "Summary", true)}
      {field("steps", "Steps (one per line)", true)}
      {field("risks", "Risks and downsides", true)}
      <label>
        Risk level
        <select value={risk} onChange={(e) => setRisk(e.target.value as typeof risk)}>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
      </label>
      <div className="row">
        <button className="btn" disabled={busy} onClick={() => void check()}>
          {busy ? "Checking…" : "Run check"}
        </button>
        <button className="btn ghost" onClick={() => setF(SCAM_EXAMPLE)}>
          Load a scam example
        </button>
      </div>
      {err && <p role="alert">{err}</p>}
      {res && (
        <>
          <p>
            Final verdict: <VerdictTag verdict={res.final} />
          </p>
          <RiskPanel result={res.rules} aiReasons={res.ai.reasons} />
          {!res.ai.available && <p className="muted">AI review unavailable ({res.ai.error}). Rules-based check applied.</p>}
        </>
      )}
    </section>
  );
}
