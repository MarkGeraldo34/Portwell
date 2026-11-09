import { STRATEGIES } from "@/data/strategies";
import { FeedPosts } from "@/components/FeedPosts";
import { FeedTabs } from "@/components/FeedTabs";
import { scanPost } from "@/lib/risk";
import { riskInputFor } from "@/server/strategy-content";

export default function Home() {
  const scanned = STRATEGIES.map((s) => ({ s, risk: scanPost(riskInputFor(s)) }));
  const visible = scanned.filter((x) => x.risk.verdict !== "block");
  const hidden = scanned.length - visible.length;
  const posts = visible.map(({ s }) => ({ id: s.id, sharer: s.sharer, title: s.title }));
  return (
    <>
      <h1>Learn to earn crypto, anon!</h1>
      <FeedTabs active="strategies" />
      <FeedPosts posts={posts} />
      {hidden > 0 && <p className="muted">{hidden} post(s) hidden by the scam check.</p>}
    </>
  );
}
