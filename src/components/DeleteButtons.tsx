"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "./WalletProvider";
import { proofMessage, RECIPIENT } from "@/lib/proof-message";
import { CONTRACT_CONFIGURED } from "@/lib/config";
import { listSubscriptionsFor } from "@/lib/contract";
import { postLocked, requestLocked } from "@/lib/delete-rules";
import { buildRequestDelete } from "@/lib/social-format";
import { SOCIAL_CONTRACT, STORAGE_DEPOSIT } from "@/lib/social";

const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
  </svg>
);

/** Two-step delete: first press asks "Delete?", second press does it. Nothing happens on a single stray click. */
function Confirm({ label, busy, error, onDelete }: { label: string; busy: boolean; error: string; onDelete: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button className="btn-delete" onClick={() => setAsking(true)} title={label} aria-label={label}>
        <TrashIcon /> Delete
      </button>
    );
  }
  return (
    <span className="delete-confirm" role="group" aria-label="Confirm delete">
      <span>Delete for good?</span>
      <button className="btn-delete solid" disabled={busy} onClick={onDelete}>{busy ? "Deleting…" : "Yes, delete"}</button>
      <button className="btn-delete quiet" disabled={busy} onClick={() => setAsking(false)}>Keep</button>
      {error && <span className="ai-msg" role="alert">{error}</span>}
    </span>
  );
}

/** "locked" while subscriptions hold money in escrow; unknown (null) until the chain has answered. */
function useLocked(owner: string, check: (subs: Awaited<ReturnType<typeof listSubscriptionsFor>>) => boolean): boolean | null {
  const { accountId } = useWallet();
  const [locked, setLocked] = useState<boolean | null>(CONTRACT_CONFIGURED ? null : false);
  useEffect(() => {
    if (!CONTRACT_CONFIGURED || accountId !== owner) return;
    let live = true;
    listSubscriptionsFor(owner)
      .then((subs) => live && setLocked(check(subs)))
      .catch(() => live && setLocked(true)); // cannot tell, so do not offer delete
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, owner]);
  return locked;
}

const LockedNote = ({ what }: { what: string }) => (
  <span className="delete-locked" title={`Cannot be deleted while a subscription is active or disputed`}>
    Subscribed · {what} can&apos;t be deleted
  </span>
);

/** Shown only to the account that published the post. The wallet signs the post id (free, no transaction). */
export function DeletePostButton({ id, sharer }: { id: string; sharer: string }) {
  const { accountId, signMessage } = useWallet();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLSpanElement>(null);
  const locked = useLocked(sharer, (subs) => postLocked(subs, sharer));
  if (!accountId || accountId !== sharer || locked === null) return null;
  if (locked) return <LockedNote what="post" />;

  async function remove() {
    setBusy(true);
    setError("");
    try {
      const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(32)));
      const message = proofMessage("delete", accountId!, Date.now(), id);
      const s = await signMessage({ message, recipient: RECIPIENT, nonce });
      const auth = { accountId: s.accountId, publicKey: s.publicKey, signature: s.signature, message, nonce: nonce.toString("base64") };
      const res = await fetch("/api/posts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, auth }) });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok && res.status !== 404) throw new Error(j.error ?? "Could not delete the post.");
      ref.current?.closest("article")?.remove(); // gone from view at once, also on pages that load their own list
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the post.");
      setBusy(false);
    }
  }
  return (
    <span ref={ref}>
      <Confirm label="Delete this post" busy={busy} error={error} onDelete={() => void remove()} />
    </span>
  );
}

/** Shown only to the learner who made the request. Removes it from NEAR Social DB with one wallet approval. */
export function DeleteRequestButton({ learner, id, offerSharers, onDeleted }: { learner: string; id: string; offerSharers: string[]; onDeleted: () => void }) {
  const { accountId, callTo } = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useLocked(learner, (subs) => requestLocked(subs, learner, offerSharers));
  if (!accountId || accountId !== learner || locked === null) return null;
  if (locked) return <LockedNote what="request" />;

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await callTo(SOCIAL_CONTRACT, "set", buildRequestDelete(learner, id), STORAGE_DEPOSIT);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the request.");
      setBusy(false);
    }
  }
  return <Confirm label="Delete this request" busy={busy} error={error} onDelete={() => void remove()} />;
}
