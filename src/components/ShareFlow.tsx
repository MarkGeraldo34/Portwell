"use client";

import { useEffect, useState } from "react";
import { PostForm } from "./PostForm";
import { SetPriceForm } from "./SetPriceForm";
import { useWallet } from "./WalletProvider";

/** A sharer must have a published post (which passed the AI scam review) before they can set a price. */
export function ShareFlow() {
  const { accountId } = useWallet();
  const [published, setPublished] = useState(false);

  // A returning sharer who already has a post does not need to publish again to change their price.
  useEffect(() => {
    setPublished(false);
    if (!accountId) return;
    let cancelled = false;
    fetch(`/api/posts?sharer=${encodeURIComponent(accountId)}`)
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((j: { posts?: unknown[] }) => {
        if (!cancelled && (j.posts?.length ?? 0) > 0) setPublished(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  return (
    <div className="share">
      <PostForm onPublished={() => setPublished(true)} />
      <SetPriceForm approved={published} />
    </div>
  );
}
