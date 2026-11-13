import { FeedPosts } from "@/components/FeedPosts";
import { scanPost } from "@/lib/risk";
import { loadCards } from "@/server/posts";
import { ethosFor } from "@/server/ethos";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cards = await loadCards();
  // Posts were already reviewed (rules + AI) before they were saved. This is a second, cheap check on the public text.
  const visible = cards.filter(
    (c) => scanPost({ title: c.title, summary: c.summary, steps: [], risks: "Risks are listed in the locked section.", risk: c.risk, capitalNeededNear: c.capitalNeededNear }).verdict !== "block",
  );
  const hidden = cards.length - visible.length;
  const ethos = await ethosFor(visible.map((c) => c.xHandle));
  const posts = visible.map((c) => ({
    id: c.id,
    sharer: c.sharer,
    title: c.title,
    xHandle: c.xHandle,
    email: c.email,
    duration: c.duration,
    ethos: c.xHandle ? ethos[c.xHandle.toLowerCase()] : undefined,
    mediaCount: c.media.length,
  }));
  return (
    <>
      <h1>Learn to earn crypto, anon!</h1>
      {posts.length === 0 && <p className="muted">No posts yet. Be the first to share one.</p>}
      <FeedPosts posts={posts} />
      {hidden > 0 && <p className="muted">{hidden} post(s) hidden by the scam check.</p>}
    </>
  );
}
