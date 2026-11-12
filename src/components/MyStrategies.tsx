"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "./WalletProvider";
import { FeedPosts, type FeedPost } from "./FeedPosts";

/** Only the strategies posted by the connected wallet. */
export function MyStrategies() {
  const { accountId, signIn } = useWallet();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setPosts(null);
    setErr("");
    if (!accountId) return;
    let live = true;
    fetch(`/api/posts?sharer=${encodeURIComponent(accountId)}&cards=1`)
      .then((r) => r.json())
      .then((j: { cards?: FeedPost[] }) => live && setPosts(j.cards ?? []))
      .catch(() => {
        if (live) {
          setErr("Could not load your strategies. Try again in a moment.");
          setPosts([]);
        }
      });
    return () => {
      live = false;
    };
  }, [accountId]);

  if (!accountId) {
    return (
      <section className="card">
        <p className="muted">Connect your wallet to see the strategies you posted.</p>
        <button className="btn" onClick={signIn}>Connect wallet</button>
      </section>
    );
  }
  if (posts === null) return <p className="muted">Loading your strategies…</p>;
  return (
    <>
      {err && <p className="ai-msg" role="alert">{err}</p>}
      {posts.length === 0 && !err && (
        <section className="card">
          <p className="muted" style={{ marginTop: 0 }}>You have not posted a strategy yet.</p>
          <Link className="btn" href="/share">Share post</Link>
        </section>
      )}
      <FeedPosts posts={posts} />
    </>
  );
}
