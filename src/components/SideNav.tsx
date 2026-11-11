"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const svg = (children: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const ITEMS: { href: string; label: string; icon: ReactNode; match: (p: string) => boolean }[] = [
  {
    href: "/",
    label: "Strategies",
    match: (p) => p === "/" || p.startsWith("/sharers") || p.startsWith("/feed"),
    icon: svg(
      <>
        <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" />
        <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
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
    label: "Requests",
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
    href: "/notifications",
    label: "Notifications",
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

/** Left sidebar on desktop; becomes a bottom tab bar on phones. */
export function SideNav() {
  const path = usePathname() ?? "/";
  return (
    <nav className="sidenav" aria-label="Main">
      {ITEMS.map((it) => {
        const on = it.match(path);
        return (
          <Link key={it.href} href={it.href} className={on ? "side-item on" : "side-item"} aria-label={it.label} title={it.label} aria-current={on ? "page" : undefined}>
            {it.icon}
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
