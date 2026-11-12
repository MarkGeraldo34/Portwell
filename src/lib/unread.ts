// Pure helpers for the "new activity" badges in the navigation (no network, easy to test).
export type BadgeKey = "notifications" | "requests";

/** Items newer than the last time the person opened that page. */
export const countNewer = (stamps: number[], seen: number): number => stamps.filter((t) => t > seen).length;

/** What the badge prints: 1..99, then "99+". Zero prints nothing. */
export const badgeText = (n: number): string => (n <= 0 ? "" : n > 99 ? "99+" : String(n));
