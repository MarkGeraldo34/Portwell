import { FeedPosts } from "@/components/FeedPosts";
import { scanPost } from "@/lib/risk";
import { loadCards } from "@/server/posts";
import { ethosFor } from "@/server/ethos";
import { xVerifiedFor } from "@/server/blob-store";
import ScrollImageReveal from "@/components/ScrollImageReveal";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cards = await loadCards();
  // Posts were already reviewed (rules + AI) before they were saved. This is a second, cheap check on the public text.
  const visible = cards.filter(
    (c) => scanPost({ title: c.title, summary: c.summary, steps: [], risks: "Risks are listed in the locked section.", risk: c.risk, capitalNeededNear: c.capitalNeededNear }).verdict !== "block",
  );
  const hidden = cards.length - visible.length;
  // A handle only counts when the sharer proved they own it (tweet challenge). Ethos is looked up for those alone.
  const proven = await xVerifiedFor(visible.map((c) => c.sharer)).catch(() => ({}) as Record<string, string>);
  const isVerified = (c: { sharer: string; xHandle?: string }) => !!c.xHandle && proven[c.sharer]?.toLowerCase() === c.xHandle.toLowerCase();
  const ethos = await ethosFor(visible.filter(isVerified).map((c) => c.xHandle));
  const posts = visible.map((c) => ({
    id: c.id,
    sharer: c.sharer,
    title: c.title,
    xHandle: c.xHandle,
    email: c.email,
    duration: c.duration,
    verified: isVerified(c),
    ethos: c.xHandle && isVerified(c) ? ethos[c.xHandle.toLowerCase()] : undefined,
    mediaCount: c.media.length,
  }));
  return (
    <>
      <h1>Search ways to earn crypto, anon!</h1>
      {posts.length === 0 && <p className="muted">No posts yet. Be the first to share one.</p>}
      <FeedPosts posts={posts} />
      {hidden > 0 && <p className="muted">{hidden} post(s) hidden by the scam check.</p>}
      <section className="how" aria-labelledby="how-h">
        <h2 id="how-h">How a payment works</h2>
        <p className="muted">Your payment is held in escrow on NEAR and released to the sharer in four weekly parts. Cancel for a refund of the unreleased weeks, or open a dispute.</p>
        <ScrollImageReveal src="/how-it-works.jpg" alt="Pay the exact price, the contract holds it, four weekly releases to the sharer, refund or dispute" mask="curtain" direction="down" parallax={10} className="sir-frame" />
      </section>
    </>
  );
}
