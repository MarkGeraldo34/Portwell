"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "./WalletProvider";
import { AccountLink } from "./AccountLink";
import { SubscribeProvider, useSubscribe } from "./SubscribePanel";
import { loadBoard } from "@/lib/social";
import type { OfferPost, RequestPost } from "@/lib/social-format";
import { formatDuration } from "@/lib/duration";
import { mailLink } from "@/lib/mail-link";

/** The subscribe card. It only ever talks about the learner's budget; the sharer's own saved price is never shown here. */
function BudgetSubscribe({ req, sharer }: { req: RequestPost; sharer: string }) {
  const sub = useSubscribe();
  const { accountId, signIn } = useWallet();
  if (!sub) return null;
  const isLearner = accountId === req.learner;
  const dur = req.duration ? formatDuration(req.duration) : null;

  let action: React.ReactNode;
  if (!accountId) action = <button className="btn" onClick={signIn}>Connect wallet to subscribe</button>;
  else if (!isLearner) action = <p className="muted rq-note">Only <b>{req.learner}</b> can subscribe from this request.</p>;
  else if (sub.price === undefined) action = <p className="muted rq-note">Checking…</p>;
  else if (sub.price === null) action = <p className="muted rq-note">This sharer has not set up subscriptions yet, so it cannot be paid from here. Email them to ask.</p>;
  else if (sub.mismatch)
    action = (
      <>
        <button className="btn" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>Subscribe · {req.budget} NEAR / 30 days</button>
        <p className="muted rq-note">This sharer&apos;s subscription is not set to your {req.budget} NEAR budget yet, so it cannot be paid from here. Email them and ask them to match it.</p>
      </>
    );
  else
    action = (
      <button className="btn" onClick={() => void sub.subscribe()} disabled={sub.subscribed || sub.sending} style={sub.subscribed || sub.sending ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
        {sub.subscribed ? "Subscribed ✓" : sub.sending ? "Subscribing…" : `Subscribe · ${req.budget} NEAR / 30 days`}
      </button>
    );

  return (
    <section className="rq-pay" aria-label="Subscribe">
      <p className="pay-line">
        You pay <b>{req.budget} NEAR</b>{dur ? <> for your {dur} request</> : null}, held in escrow on NEAR and released to <AccountLink account={sharer} /> in four weekly parts. You can refund the unreleased weeks or open a dispute.
      </p>
      {action}
      {sub.msg && <p role="status" className="muted rq-note">{sub.msg}</p>}
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
    <article className="rq">
      <Link className="rq-back" href={accountId === learner ? "/my-requests" : "/requests"}>← Back to requests</Link>
      <span className="rq-kicker">Your request</span>
      <h1 className="rq-title">{req.title}</h1>
      <div className="rq-facts">
        <span className="chip"><b>{req.budget} NEAR</b> budget</span>
        {req.duration && <span className="chip">for {formatDuration(req.duration)}</span>}
        <span className="muted">by <AccountLink account={req.learner} /></span>
      </div>
      {req.details && <p className="req-details">{req.details}</p>}

      <h2 className="rq-h">Offer to teach you</h2>
      <div className="rq-offer">
        <span className="offer-who"><AccountLink account={offer.sharer} /></span>
        <span className="offer-says">has accepted your budget and offered to teach you</span>
        {xHandle ? (
          <a className="contact-btn" href={`https://x.com/${encodeURIComponent(xHandle)}`} target="_blank" rel="noopener noreferrer nofollow" aria-label={`@${xHandle} on X, verified`} title={`@${xHandle} on X, verified`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/x-logo.png" alt="" width={18} height={18} />
            <span className="xv-tick" aria-hidden="true">✓</span>
          </a>
        ) : (
          <span className="contact-btn unverified" title="This sharer has not proven they own an X account. Be careful.">⚠ Unverified X</span>
        )}
        {addr && (
          <a className="contact-btn" href={mailLink(addr).href} target={mailLink(addr).webmail ? "_blank" : undefined} rel="noopener noreferrer nofollow" aria-label={`Email @${offer.sharer}`} title={`Email ${addr}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/gmail-logo.png" alt="" width={18} height={18} />
          </a>
        )}
      </div>
      {offer.note && <p className="offer-note">“{offer.note}”</p>}

      <SubscribeProvider sharer={sharer} expected={req.budget}>
        <BudgetSubscribe req={req} sharer={sharer} />
      </SubscribeProvider>
    </article>
  );
}
