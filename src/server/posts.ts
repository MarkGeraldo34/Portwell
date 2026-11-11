import "server-only";
import { STRATEGIES } from "@/data/strategies";
import type { PostCard } from "@/lib/post-format";
import { detailFor, type StrategyDetail } from "@/server/strategy-content";
import { blobConfigured, listCards, readGated } from "@/server/blob-store";

// One place that answers "which posts exist". Real posts come from Vercel Blob. When storage is not set up
// yet (local demo), the two built-in demo posts are shown instead so the site is never empty.

const demoCards = (): PostCard[] =>
  STRATEGIES.map((s, i) => ({
    v: 1 as const,
    id: s.id,
    sharer: s.sharer,
    title: s.title,
    summary: s.summary,
    risk: s.risk,
    capitalNeededNear: s.capitalNeededNear,
    steps: detailFor(s.id).steps.length,
    media: [],
    ts: i,
  }));

export async function loadCards(): Promise<PostCard[]> {
  if (!blobConfigured()) return demoCards();
  try {
    return await listCards();
  } catch {
    return [];
  }
}

export async function cardsBySharer(sharer: string): Promise<PostCard[]> {
  return (await loadCards()).filter((c) => c.sharer === sharer);
}

export const sharersOf = (cards: PostCard[]) => Array.from(new Set(cards.map((c) => c.sharer)));

/** Gated text for each of a sharer's posts. Callers must have verified the viewer first. */
export async function detailsForSharerPosts(sharer: string): Promise<StrategyDetail[]> {
  const cards = await cardsBySharer(sharer);
  return Promise.all(
    cards.map(async (c) => {
      if (!blobConfigured()) return detailFor(c.id);
      const g = await readGated(c.id);
      return { id: c.id, steps: g?.steps ?? [], risks: g?.risks ?? "", proofWallet: null };
    }),
  );
}
