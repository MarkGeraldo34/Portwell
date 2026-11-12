"use client";

import Link from "next/link";
import { Fragment } from "react";
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

const ACCOUNT_RE = /\b([a-z0-9_-]+(?:\.[a-z0-9_-]+)*\.(?:testnet|near))\b/g;

/** Turns every NEAR account id inside a sentence into a link to that wallet's profile. */
export function Linkify({ text }: { text: string }) {
  const parts: (string | { id: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(ACCOUNT_RE)) {
    const at = m.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    parts.push({ id: m[1] });
    last = at + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <>
      {parts.map((p, i) => (typeof p === "string" ? <Fragment key={i}>{p}</Fragment> : <AccountLink key={i} account={p.id} full />))}
    </>
  );
}
