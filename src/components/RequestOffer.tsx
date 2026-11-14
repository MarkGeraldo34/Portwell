"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "./WalletProvider";
import { AccountLink } from "./AccountLink";
import { loadBoard } from "@/lib/social";
import { formatNear, getAcceptedBudget, listSubscriptionsFor, parseNear } from "@/lib/contract";
import type { OfferPost, RequestPost } from "@/lib/social-format";
import { formatDuration } from "@/lib/duration";
import { mailLink } from "@/lib/mail-link";

/** The subscribe card. The learner pays their own budget, never the sharer's saved price. */
function BudgetSubscribe({ req, sharer, offerTs }: { req: RequestPost; sharer: string; offerTs: number }) {
  const { accountId, signIn, call } = useWallet();
  const [subscribed, setSubscribed] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const isLearner = accountId === req.learner;
  const dur = req.duration ? formatDuration(req.duration) : null;

  useEffect(() => {
    setSubscribed(false);
    if (!accountId || accountId !== req.learner) return;
    let live = true;
    listSubscriptionsFor(accountId)
      // Only a subscription that started after this offer counts as this request's. An older one (for example from a
      // post you subscribed to earlier) must not make this button say "Subscribed".
      .then((subs) => live && setSubscribed(subs.some((x) => x.learner === accountId && x.sharer === sharer && x.status === "Active" && Number(BigInt(x.start_ns) / 1_000_000n) >= offerTs)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [accountId, req.learner, sharer, offerTs]);

  async function subscribe() {
    if (sending || subscribed) return;
    setSending(true);
    setMsg("Waiting for wallet approval…");
    try {
      // The sharer approved this learner's budget on-chain when they pressed Offer to teach. Pay exactly that.
      const approved = await getAcceptedBudget(sharer, req.learner);
      if (!approved) throw new Error("The sharer has not confirmed this offer on-chain yet, so there is nothing to pay. Ask them (by email) to press Offer to teach again, then try once more.");
      if (BigInt(approved) !== parseNear(String(req.budget))) throw new Error(`The sharer approved ${formatNear(approved, 4)} NEAR, which is not your ${req.budget} NEAR budget. Do not pay; ask them to offer again.`);
      await call("subscribe_offer", { sharer }, BigInt(approved));
      setSubscribed(true);
      setMsg("Sent. Your payment is held in escrow and released weekly. The sharer has 24 hours to start posting; if they do not start sharing after 24 hours, click Refund on your subscription. Open My subscriptions (the card icon at the top) and press the refresh icon to see it.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setSending(false);
    }
  }

  let action: React.ReactNode;
  if (!accountId) action = <button className="btn" onClick={signIn}>Connect wallet to subscribe</button>;
  else if (!isLearner) action = <p className="muted" style={{ fontSize: 13 }}>Only <b>{req.learner}</b> can subscribe from this request.</p>;
  else
    action = (
      <button className="btn" onClick={() => void subscribe()} disabled={subscribed || sending} style={subscribed || sending ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
        {subscribed ? "Subscribed ✓" : sending ? "Subscribing…" : `Subscribe · ${req.budget} NEAR / 30 days`}
      </button>
    );

  return (
    <section className="card" aria-label="Subscribe">
      <h3>Subscribe</h3>
      <p className="pay-line">
        You pay <b>{req.budget} NEAR</b>{dur ? <> for {dur}</> : null}, held in escrow on NEAR and released to <AccountLink account={sharer} /> in four weekly parts. You can refund the unreleased weeks or open a dispute.
      </p>
      {isLearner && !subscribed && (
        <p className="offer-prompt" role="note">
          Before you subscribe: email the sharer and wait for their reply. Subscribe on the site only after they have answered.
        </p>
      )}
      {action}
      {msg && <p role="status" className="muted" style={{ fontSize: 13, margin: "8px 0 0" }}>{msg}</p>}
    </section>
  );
}

export function RequestOffer({ learner, id, sharer }: { learner: string; id: string; sharer: string }) {
  const { accountId } = useWallet();
  const [state, setState] = useState<{ req: RequestPost; offer: OfferPost } | "loading" | "missing" | "error">("loading");
  const [xHandle, setXHandle] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadBoard(200)
      .then((board) => {
        if (!live) return;
        const hit = board.find((b) => b.request.learner === learner && b.request.id === id);
        const offer = hit?.offers.find((o) => o.sharer === sharer);
        setState(hit && offer ? { req: hit.request, offer } : "missing");
      })
      .catch(() => live && setState("error"));
    fetch(`/api/x-verify?accounts=${encodeURIComponent(sharer)}`)
      .then((r) => (r.ok ? r.json() : { verified: {} }))
      .then((j: { verified?: Record<string, string> }) => live && setXHandle(j.verified?.[sharer] ?? null))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [learner, id, sharer]);

  if (state === "loading") return <p className="muted">Loading the request…</p>;
  if (state === "error") return <p className="ai-msg" role="alert">Could not load the request. Try again in a moment.</p>;
  if (state === "missing")
    return (
      <>
        <p className="muted">This request or offer could not be found. It may have been deleted, or the offer may not have appeared yet.</p>
        <Link className="btn ghost" href="/my-requests">Back to My Requests</Link>
      </>
    );

  const { req, offer } = state;
  const addr = offer.email;
  return (
    <>
      <Link className="muted" href={accountId === learner ? "/my-requests" : "/requests"} style={{ fontSize: 13 }}>← Back to requests</Link>
      <h1>View and subscribe</h1>

      <article className="post">
        <div className="post-head">
          <span className="avatar" aria-hidden="true">{req.learner[0]?.toUpperCase()}</span>
          <div className="post-id">
            <h3 className="post-title">{req.title}</h3>
            <span className="post-meta-id">
              Request by <AccountLink account={req.learner} />
            </span>
          </div>
          <div className="budget">
            <b>{req.budget}</b>
            <span>NEAR budget</span>
            {req.duration && <span className="duration-chip">for {formatDuration(req.duration)}</span>}
          </div>
        </div>
        {req.details && <p className="req-details">{req.details}</p>}
      </article>

      <section className="card" aria-label="The offer">
        <h3>Offer to teach you</h3>
        <ul className="offers">
          <li>
            <span className="offer-who"><AccountLink account={offer.sharer} /></span>
            <span className="offer-says">has accepted your budget and offered to teach you</span>
            {xHandle ? (
              <a className="contact-btn" href={`https://x.com/${encodeURIComponent(xHandle)}`} target="_blank" rel="noopener noreferrer nofollow" aria-label={`@${xHandle} on X, verified`} title={`@${xHandle} on X, verified`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/x-logo.png" alt="" width={18} height={18} />
                <span className="xv-tick" aria-hidden="true">✓</span>
              </a>
            ) : (
              <span className="contact-btn unverified" title="This sharer has not proven they own an X account. Be careful.">
                <span aria-hidden="true">⚠</span> Unverified X
              </span>
            )}
            {offer.note && <span className="offer-note">“{offer.note}”</span>}
            {addr && (
              <a className="contact-btn" href={mailLink(addr).href} target={mailLink(addr).webmail ? "_blank" : undefined} rel="noopener noreferrer nofollow" aria-label={`Email @${offer.sharer}`} title={`Email ${addr}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/gmail-logo.png" alt="" width={18} height={18} />
              </a>
            )}
          </li>
        </ul>
      </section>

      <BudgetSubscribe req={req} sharer={sharer} offerTs={offer.ts} />
    </>
  );
}
