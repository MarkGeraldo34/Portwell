"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "./WalletProvider";
import { CONTRACT_CONFIGURED } from "@/lib/config";
import { listSubscriptionsFor } from "@/lib/contract";
import { fetchChatIncoming } from "@/lib/chat-activity";
import { badgeText, countNewer } from "@/lib/unread";

const seenKey = (account: string) => `portwell:seen:${account}:subs`;
const readSeen = (account: string): number => {
  try {
    return Number(window.localStorage.getItem(seenKey(account))) || 0;
  } catch {
    return 0;
  }
};
const writeSeen = (account: string, t: number) => {
  try {
    window.localStorage.setItem(seenKey(account), String(t));
  } catch {
    /* private mode: the badge just resets on reload */
  }
};

/** The "My subscriptions" icon in the header. Shows how many new subscriptions (to you) and new chat messages arrived since you last opened it. */
export function SubscriptionsIcon() {
  const path = usePathname() ?? "/";
  const { accountId } = useWallet();
  const [n, setN] = useState(0);
  const onPage = path.startsWith("/subscriptions");

  const refresh = useCallback(async () => {
    if (!accountId) return setN(0);
    if (onPage) {
      writeSeen(accountId, Date.now());
      return setN(0);
    }
    try {
      const [subs, chats] = await Promise.all([
        CONTRACT_CONFIGURED ? listSubscriptionsFor(accountId).catch(() => []) : Promise.resolve([]),
        fetchChatIncoming(accountId),
      ]);
      const seen = readSeen(accountId);
      // New subscriptions people made to you (from a post or from your offer), plus unread chat messages.
      const starts = subs.filter((s) => s.sharer === accountId).map((s) => Math.floor(Number(BigInt(s.start_ns) / 1_000_000n)));
      setN(countNewer(starts, seen) + countNewer(chats.map((c) => c.ts), seen));
    } catch {
      /* keep the previous number */
    }
  }, [accountId, onPage]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  const text = badgeText(n);
  const name = n > 0 ? `My subscriptions, ${text} new` : "My subscriptions";
  return (
    <Link href="/subscriptions" className={n > 0 ? "icon-btn has-badge" : "icon-btn"} aria-label={name} title={name}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M3 10h18" />
        <path d="M7 15h4" />
      </svg>
      {n > 0 && <b className="count-badge" aria-hidden="true">{text}</b>}
    </Link>
  );
}
