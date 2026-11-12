"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "./WalletProvider";
import { CONTRACT_CONFIGURED } from "@/lib/config";
import { formatNear, getPrice } from "@/lib/contract";
import { SOCIAL_CONTRACT, STORAGE_DEPOSIT, loadBoard } from "@/lib/social";
import { LIMITS, buildOfferSet, buildRequestSet, validateOffer, validateRequest, type OfferPost, type RequestPost } from "@/lib/social-format";
import { scanPost } from "@/lib/risk";
import { requireAiApproval } from "@/lib/ai-gate";
import { mailLink } from "@/lib/mail-link";

interface Card {
  req: RequestPost;
  offers: (OfferPost & { price: number | null })[];
}

const short = (a: string) => (a.length > 26 ? `${a.slice(0, 12)}…${a.slice(-10)}` : a);
const ago = (ts: number) => {
  if (!ts) return "";
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};

export function RequestBoard({ mode, emails = {} }: { mode: "form" | "list"; emails?: Record<string, string> }) {
  const { accountId, signIn, callTo } = useWallet();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [form, setForm] = useState({ title: "", details: "", budget: "1" });
  const [msg, setMsgText] = useState("");
  const [bad, setBad] = useState(false); // red text for AI-check and safety messages
  const setMsg = (text: string, isBad = false) => {
    setMsgText(text);
    setBad(isBad);
  };
  const [busy, setBusy] = useState(false);
  const [offering, setOffering] = useState<string | null>(null); // "learner/blockHeight" being answered
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoadErr("");
    try {
      const board = await loadBoard(30);
      const withOffers = await Promise.all(
        board.map(async ({ request: req, offers }) => {
          // Only people who have set a price in the escrow contract can actually be paid.
          const priced = await Promise.all(
            offers.map(async (o) => {
              const p = CONTRACT_CONFIGURED ? await getPrice(o.sharer).catch(() => null) : null;
              return { ...o, price: p ? Number(formatNear(p, 4)) : null };
            }),
          );
          return { req, offers: priced.filter((o) => o.price !== null) };
        }),
      );
      setCards(withOffers);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load requests");
      setCards([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function post() {
    if (!accountId) return signIn();
    const v = validateRequest(form);
    if (!v.ok) return setMsg(v.error);
    // Same scam rules as strategy posts: no seed phrases, guaranteed returns, "send me funds first"...
    const scan = scanPost({ title: v.value.t, summary: v.value.d, steps: [], risks: "", risk: "low", capitalNeededNear: 0 });
    if (scan.verdict === "block") return setMsg("This looks unsafe to publish (it mentions something like a seed phrase, guaranteed returns or sending funds first). Please reword it.", true);
    setBusy(true);
    setMsg("Running the AI scam review…");
    try {
      const blocked = await requireAiApproval({ title: v.value.t, summary: v.value.d, steps: [], risks: "", risk: "low", capitalNeededNear: 0 });
      if (blocked) return setMsg(blocked, true);
      setMsg("Review passed. Waiting for wallet approval. A small storage deposit is attached and unused NEAR is refunded.");
      await callTo(SOCIAL_CONTRACT, "set", buildRequestSet(accountId, String(v.value.ts), v.value), STORAGE_DEPOSIT);
      setForm({ title: "", details: "", budget: "1" });
      setMsg("Request posted. It can take a few seconds to appear.");
      setTimeout(() => void load(), 3000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not post the request");
    } finally {
      setBusy(false);
    }
  }

  async function offer(c: Card) {
    if (!accountId) return signIn();
    const v = validateOffer(note);
    if (!v.ok) return setMsg(v.error);
    setBusy(true);
    setMsg("Checking that you have a monthly price set…");
    try {
      if (CONTRACT_CONFIGURED && !(await getPrice(accountId).catch(() => null))) {
        setMsg("Set your monthly price first (Share post in the left menu) so learners can pay you. Then offer again.");
        return;
      }
      if (v.value.n) {
        setMsg("Running the AI scam review…");
        const blocked = await requireAiApproval({ title: "Offer to teach", summary: v.value.n, steps: [], risks: "", risk: "low", capitalNeededNear: 0 });
        if (blocked) return setMsg(blocked, true);
      }
      setMsg("Waiting for wallet approval.");
      await callTo(SOCIAL_CONTRACT, "set", buildOfferSet(accountId, c.req.learner, c.req.id, v.value), STORAGE_DEPOSIT);
      setOffering(null);
      setNote("");
      setMsg("Offer sent. It can take a few seconds to appear.");
      setTimeout(() => void load(), 3000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not send the offer");
    } finally {
      setBusy(false);
    }
  }

  // Request strategy shows only your own requests (and the offers you got); Requests shows everyone's.
  const shown = mode === "form" ? cards?.filter((c) => c.req.learner === accountId) : cards;

  return (
    <>
      {mode === "form" && (
      <section className="post req-form">
        <h3 className="post-title">Ask for a guide</h3>
        <p className="muted" style={{ margin: "4px 0 10px" }}>
          Say what you want to learn and what you would pay. Sharers can offer to teach you, and you subscribe to the one you pick.
        </p>
        <label className="field">
          What do you want to learn?
          <input value={form.title} maxLength={LIMITS.title} placeholder="e.g. Earning with NEAR staking as a beginner" onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </label>
        <label className="field">
          Details (optional)
          <textarea rows={3} value={form.details} maxLength={LIMITS.details} placeholder="Your experience, time you have, anything that helps a tutor." onChange={(e) => setForm({ ...form, details: e.target.value })} />
        </label>
        <label className="field">
          Budget for a month (NEAR)
          <input inputMode="decimal" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
        </label>
        <button className="btn" disabled={busy} onClick={() => void post()}>
          {accountId ? "Post request" : "Connect wallet to post"}
        </button>
        {msg && <p className={bad ? "ai-msg" : "muted"} role={bad ? "alert" : "status"} style={{ marginBottom: 0 }}>{msg}</p>}
      </section>
      )}
      {mode === "list" && msg && <p className={bad ? "ai-msg" : "muted"} role={bad ? "alert" : "status"}>{msg}</p>}

      {cards === null && <p className="muted">Loading requests…</p>}
      {loadErr && <p className="muted">Could not load requests right now ({loadErr}). Try again in a moment.</p>}
      {shown?.length === 0 && !loadErr && <p className="muted">{mode === "form" ? "You have not requested a strategy yet." : "No requests yet. Learners who ask for a strategy will show up here."}</p>}

      {mode === "form" && shown && shown.length > 0 && <h2 className="board-title">Your requests</h2>}
      {shown?.map((c) => {
        const id = `${c.req.learner}/${c.req.id}`;
        const mine = c.req.learner === accountId;
        return (
          <article className="post" key={id}>
            <div className="post-head">
              <span className="avatar" aria-hidden="true">{c.req.learner[0]?.toUpperCase()}</span>
              <div className="post-id">
                <h3 className="post-title">{c.req.title}</h3>
                <span className="post-meta-id" title={c.req.learner}>
                  @{short(c.req.learner)} {c.req.ts ? `· ${ago(c.req.ts)}` : ""}
                </span>
              </div>
              <div className="budget">
                <b>{c.req.budget}</b>
                <span>NEAR budget</span>
              </div>
            </div>
            {c.req.details && <p className="req-details">{c.req.details}</p>}

            {c.offers.length > 0 && (
              <ul className="offers">
                {c.offers.map((o) => (
                  <li key={o.sharer}>
                    <span className="offer-who" title={o.sharer}>@{short(o.sharer)}</span>
                    <span className={`chip${o.price !== null && o.price <= c.req.budget ? "" : " warn"}`}>
                      {o.price} NEAR / 30 days {o.price !== null && o.price <= c.req.budget ? "· in budget" : "· above budget"}
                    </span>
                    {o.note && <span className="offer-note">“{o.note}”</span>}
                    {emails[o.sharer] && (
                      <a className="contact-btn" href={mailLink(emails[o.sharer]).href} target={mailLink(emails[o.sharer]).webmail ? "_blank" : undefined} rel="noopener noreferrer nofollow" title={`Email ${emails[o.sharer]}`} aria-label={`Email @${o.sharer}`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="3" y="5" width="18" height="14" rx="2" />
                          <path d="M3 7l9 6 9-6" />
                        </svg>
                      </a>
                    )}
                    {mine && <Link className="offer-link" href={`/sharers/${o.sharer}`}>View &amp; subscribe →</Link>}
                  </li>
                ))}
              </ul>
            )}
            {mine && c.offers.length > 0 && (
              <p className="offer-prompt" role="note">
                Before you subscribe: email the sharer you are interested in subscribing to their strategy, and wait for their reply. Subscribe on the site only after they have answered.
              </p>
            )}

            <div className="post-foot">
              <span className="muted" style={{ fontSize: 13 }}>
                {c.offers.length} offer{c.offers.length === 1 ? "" : "s"}
              </span>
              {mine ? (
                <span className="muted" style={{ fontSize: 13 }}>Your request</span>
              ) : offering === id ? (
                <div className="offer-box">
                  <input value={note} maxLength={LIMITS.note} placeholder="Short note (optional)" onChange={(e) => setNote(e.target.value)} />
                  <button className="btn" disabled={busy} onClick={() => void offer(c)}>Send offer</button>
                  <button className="btn ghost" onClick={() => setOffering(null)}>Cancel</button>
                </div>
              ) : (
                <button className="btn" onClick={() => (accountId ? setOffering(id) : signIn())}>
                  {accountId ? "Offer to teach" : "Connect to offer"}
                </button>
              )}
            </div>
          </article>
        );
      })}
    </>
  );
}
