"use client";

import { useWallet } from "./WalletProvider";

export function ConnectButton() {
  const { accountId, ready, signIn, signOut } = useWallet();
  if (!accountId) {
    return (
      <button className="btn" disabled={!ready} onClick={signIn}>
        Connect NEAR wallet
      </button>
    );
  }
  return (
    <span className="row">
      <code>{accountId}</code>
      <button className="btn ghost" onClick={() => void signOut()}>
        Sign out
      </button>
    </span>
  );
}
