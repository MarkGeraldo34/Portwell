"use client";

import Link from "next/link";
import { useWallet } from "./WalletProvider";

export function ConnectButton() {
  const { accountId, ready, signIn, signOut } = useWallet();
  if (!accountId) {
    return (
      <button className="btn" disabled={!ready} onClick={signIn}>
        <span className="long">Connect NEAR wallet</span>
        <span className="short">Connect</span>
      </button>
    );
  }
  return (
    <span className="row">
      <Link href={`/u/${encodeURIComponent(accountId)}`} className="acct-link" title="Your profile"><code>{accountId}</code></Link>
      <button className="btn ghost" onClick={() => void signOut()}>
        Sign out
      </button>
    </span>
  );
}
