import Link from "next/link";

/** Two-way switch shown at the top of the feed and the requests page. */
export function FeedTabs({ active }: { active: "strategies" | "requests" }) {
  return (
    <nav className="tabs" aria-label="Feed sections">
      <Link href="/" className={active === "strategies" ? "tab on" : "tab"} aria-current={active === "strategies" ? "page" : undefined}>
        Strategies
      </Link>
      <Link href="/requests" className={active === "requests" ? "tab on" : "tab"} aria-current={active === "requests" ? "page" : undefined}>
        Requests
      </Link>
    </nav>
  );
}
