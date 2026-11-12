"use client";

import Link from "next/link";
import { useWallet } from "./WalletProvider";

const short = (a: string) => (a.length > 28 ? `${a.slice(0, 14)}…${a.slice(-10)}` : a);

/** A wallet id that links to its profile. The connected wallet sees itself as "you". */
export function AccountLink({ account, full = false, className = "" }: { account: string; full?: boolean; className?: string }) {
  const { accountId } = useWallet();
  const me = accountId === account;
  return (
    <Link href={`/u/${encodeURIComponent(account)}`} className={`acct-link${me ? " is-me" : ""} ${className}`.trim()} title={me ? `${account} (you)` : account}>
      {me ? "you" : `@${full ? account : short(account)}`}
    </Link>
  );
}
