import "server-only";

// Ethos Network reputation (https://app.ethos.network). Public API, no key needed.
// Docs: https://developers.ethos.network/api-documentation/api-v2/operations/users-getbytwitter.html

import type { Ethos } from "@/lib/ethos-types";

export type { Ethos };

const profileUrl = (handle: string) => `https://app.ethos.network/profile/x/${encodeURIComponent(handle)}`;

export async function getEthos(handle: string): Promise<Ethos> {
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return { state: "none" };
  try {
    const res = await fetch(`https://api.ethos.network/api/v2/user/by/x/${encodeURIComponent(handle)}`, {
      headers: { "X-Ethos-Client": "portwell", Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 3600 },
    });
    if (res.status === 404) return { state: "none" };
    if (!res.ok) return { state: "unknown", url: profileUrl(handle) };
    const j = (await res.json()) as { score?: unknown; links?: { profile?: unknown } };
    let url = profileUrl(handle);
    if (typeof j.links?.profile === "string") {
      try {
        const u = new URL(j.links.profile);
        if (u.protocol === "https:" && u.hostname === "app.ethos.network") url = u.toString();
      } catch {
        /* keep the fallback */
      }
    }
    return typeof j.score === "number" ? { state: "ok", score: j.score, url } : { state: "unknown", url };
  } catch {
    return { state: "unknown", url: profileUrl(handle) };
  }
}

export async function ethosFor(handles: (string | undefined)[]): Promise<Record<string, Ethos>> {
  const uniq = Array.from(new Set(handles.filter((h): h is string => !!h)));
  const entries = await Promise.all(uniq.map(async (h) => [h.toLowerCase(), await getEthos(h)] as const));
  return Object.fromEntries(entries);
}
