"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteRequestButton } from "./DeleteButtons";
import { HaloCard } from "./HaloCard";
import { RequestLessons } from "./RequestLessons";
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
      setMsg("Subscribed. Your payment is now held in escrow. Next: the sharer has 24 hours to start posting lessons below. If they have not started after 24 hours, press Refund on your subscription. Find it under My subscriptions (the card icon at the top); press the refresh icon if it is not listed yet.");
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
    <>
      <ul className="pay-points">
        <li><b>You pay {req.budget} NEAR</b>{dur ? <> for {dur}</> : null}. This is your own budget, not the sharer&apos;s usual price.</li>
        <li>Your money is <b>held in escrow</b> on NEAR. It does not go straight to the sharer.</li>
        <li>It is released to <AccountLink account={sharer} /> in <b>4 weekly parts</b>.</li>
        <li>If they do not deliver, you can <b>refund the unreleased weeks</b> or <b>open a dispute</b>.</li>
      </ul>
      {isLearner && !subscribed && (
        <p className="offer-prompt" role="note">
          <b>Do this first:</b> email <b>{sharer}</b> and wait for their reply. Press Subscribe only after they have answered.
        </p>
      )}
      {action}
      {msg && <p role="status" className="muted" style={{ fontSize: 13, margin: "8px 0 0" }}>{msg}</p>}
    </>
  );
}

export function RequestOffer({ learner, id, sharer }: { learner: string; id: string; sharer: string }) {
  const { accountId } = useWallet();
  const router = useRouter();
  const [state, setState] = useState<{ req: RequestPost; offer: OfferPost; offerSharers: string[] } | "loading" | "missing" | "error">("loading");
  const [xHandle, setXHandle] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadBoard(200)
      .then((board) => {
        if (!live) return;
        const hit = board.find((b) => b.request.learner === learner && b.request.id === id);
        const offer = hit?.offers.find((o) => o.sharer === sharer);
        setState(hit && offer ? { req: hit.request, offer, offerSharers: hit.offers.map((o) => o.sharer) } : "missing");
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

  const { req, offer, offerSharers } = state;
  const addr = offer.email;
  return (
    <>
      <Link className="muted" href={accountId === learner ? "/my-requests" : "/requests"} style={{ fontSize: 13 }}>← Back to requests</Link>
      <h1>View and subscribe</h1>

      <HaloCard aria-label="Request, offer and subscription" className="req-flow">
        <ol className="flow">
          <li className="flow-step">
            <span className="flow-dot" aria-hidden="true">1</span>
            <div className="flow-body">
              <span className="flow-kicker">The topic</span>
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
              {accountId === req.learner && (
                <div className="post-foot">
                  <span className="req-actions">
                    <span className="muted" style={{ fontSize: 13 }}>Your request</span>
                    <DeleteRequestButton learner={req.learner} id={req.id} offerSharers={offerSharers} ts={req.ts} onDeleted={() => router.push("/my-requests")} />
                  </span>
                </div>
              )}
            </div>
          </li>

          <li className="flow-step">
            <span className="flow-dot" aria-hidden="true">2</span>
            <div className="flow-body">
              <span className="flow-kicker">Offer to teach you</span>
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
            </div>
          </li>

          <li className="flow-step">
            <span className="flow-dot" aria-hidden="true">3</span>
            <div className="flow-body">
              <span className="flow-kicker">Subscribe</span>
              <BudgetSubscribe req={req} sharer={sharer} offerTs={offer.ts} />
            </div>
          </li>
        </ol>
      </HaloCard>

      <RequestLessons learner={req.learner} requestId={req.id} sharer={sharer} offerTs={offer.ts} />
    </>
  );
}
