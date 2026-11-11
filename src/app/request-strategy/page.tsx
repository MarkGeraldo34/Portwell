import { RequestBoard } from "@/components/RequestBoard";
import { loadCards } from "@/server/posts";

export const dynamic = "force-dynamic";

export default async function RequestStrategyPage() {
  // Sharer emails come from their published posts (already public on the feed).
  const emails: Record<string, string> = {};
  for (const c of await loadCards().catch(() => [])) if (c.email && !emails[c.sharer]) emails[c.sharer] = c.email;
  return (
    <>
      <h1>Request strategy</h1>
      <RequestBoard mode="form" emails={emails} />
    </>
  );
}
