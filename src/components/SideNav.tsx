"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useWallet } from "./WalletProvider";
import { CONTRACT_CONFIGURED } from "@/lib/config";
import { getOwner, listSubscriptionsFor, formatNear } from "@/lib/contract";
import { loadBoard } from "@/lib/social";
import { fetchChatIncoming } from "@/lib/chat-activity";
import { buildNotifications } from "@/lib/notifications";
import { badgeText, countNewer, type BadgeKey } from "@/lib/unread";

const svg = (children: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const ITEMS: { href: string; label: string; icon: ReactNode; badge?: BadgeKey; match: (p: string) => boolean }[] = [
  {
    href: "/",
    label: "Feed",
    match: (p) => p === "/" || p.startsWith("/sharers") || p.startsWith("/feed"),
    icon: svg(
      <>
        <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" />
        <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
      </>,
    ),
  },
  {
    href: "/my-strategies",
    label: "My strategies",
    match: (p) => p.startsWith("/my-strategies"),
    icon: svg(
      <>
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </>,
    ),
  },
  {
    href: "/share",
    label: "Share post",
    match: (p) => p.startsWith("/share"),
    icon: svg(
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      </>,
    ),
  },
  {
    href: "/request-strategy",
    label: "Request strategy",
    match: (p) => p.startsWith("/request-strategy"),
    icon: svg(
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v8" />
        <path d="M8 12h8" />
      </>,
    ),
  },
  {
    href: "/requests",
    label: "All Requests",
    badge: "requests",
    match: (p) => p === "/requests" || p.startsWith("/requests/"),
    icon: svg(
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
      </>,
    ),
  },
  {
    href: "/my-requests",
    label: "My Requests",
    match: (p) => p.startsWith("/my-requests"),
    icon: svg(
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>,
    ),
  },
  {
    href: "/notifications",
    label: "Notifications",
    badge: "notifications",
    match: (p) => p.startsWith("/notifications"),
    icon: svg(
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </>,
    ),
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    match: (p) => p.startsWith("/leaderboard"),
    icon: svg(
      <>
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-1.21 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98 1.21 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
      </>,
    ),
  },
];

const seenKey = (account: string, k: BadgeKey) => `portwell:seen:${account}:${k}`;
const readSeen = (account: string, k: BadgeKey): number | null => {
  try {
    const v = window.localStorage.getItem(seenKey(account, k));
    return v === null ? null : Number(v) || 0;
  } catch {
    return null;
  }
};
const writeSeen = (account: string, k: BadgeKey, t: number) => {
  try {
    window.localStorage.setItem(seenKey(account, k), String(t));
  } catch {
    /* private mode: badges just reset on reload */
  }
};

/** Counts of new activity since the person last opened each page. Polls once a minute. */
function useBadges(path: string) {
  const { accountId } = useWallet();
  const [counts, setCounts] = useState<Record<BadgeKey, number>>({ notifications: 0, requests: 0 });

  const refresh = useCallback(async () => {
    if (!accountId) return setCounts({ notifications: 0, requests: 0 });
    try {
      const owner = CONTRACT_CONFIGURED ? await getOwner().catch(() => null) : null;
      const isOwner = owner === accountId;
      const [subs, board, chats] = await Promise.all([
        CONTRACT_CONFIGURED ? listSubscriptionsFor(accountId, { includeAll: isOwner }).catch(() => []) : Promise.resolve([]),
        loadBoard(50).catch(() => []),
        fetchChatIncoming(accountId),
      ]);
      const notes = buildNotifications(accountId, subs, board.map(({ request, offers }) => ({ request, offers })), isOwner, (y) => formatNear(y, 2), chats);
      // First visit: everything personal counts as new, but old public requests do not.
      let reqSeen = readSeen(accountId, "requests");
      if (reqSeen === null) {
        reqSeen = Date.now();
        writeSeen(accountId, "requests", reqSeen);
      }
      const here = ITEMS.find((i) => i.badge && i.match(path))?.badge;
      setCounts({
        notifications: here === "notifications" ? 0 : countNewer(notes.map((n) => n.ts), readSeen(accountId, "notifications") ?? 0),
        requests: here === "requests" ? 0 : countNewer(board.filter((b) => b.request.learner !== accountId).map((b) => b.request.ts), reqSeen),
      });
    } catch {
      /* keep the previous numbers */
    }
  }, [accountId, path]);

  // Opening a page marks it as seen.
  useEffect(() => {
    if (!accountId) return;
    const here = ITEMS.find((i) => i.badge && i.match(path))?.badge;
    if (here) {
      writeSeen(accountId, here, Date.now());
      setCounts((c) => ({ ...c, [here]: 0 }));
    }
  }, [accountId, path]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  return counts;
}

/** Left sidebar on desktop; becomes a bottom tab bar on phones. */
export function SideNav() {
  const path = usePathname() ?? "/";
  const counts = useBadges(path);
  return (
    <nav className="sidenav" aria-label="Main">
      {ITEMS.map((it) => {
        const on = it.match(path);
        const n = it.badge ? counts[it.badge] : 0;
        const text = badgeText(n);
        const name = n > 0 ? `${it.label}, ${text} new` : it.label;
        return (
          <Link key={it.href} href={it.href} className={on ? "side-item on" : "side-item"} aria-label={name} title={name} aria-current={on ? "page" : undefined}>
            <span className="side-ico">
              {it.icon}
              {n > 0 && <b className="pulse-dot" aria-hidden="true" />}
            </span>
            <span className="side-label">{it.label}</span>
            {n > 0 && <b className="count-badge" aria-hidden="true">{text}</b>}
          </Link>
        );
      })}
    </nav>
  );
}
