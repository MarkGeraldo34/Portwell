import { RequestBoard } from "@/components/RequestBoard";
import { loadCards } from "@/server/posts";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  // Sharer emails come from their published posts (already public on the feed).
  const emails: Record<string, string> = {};
  for (const c of await loadCards().catch(() => [])) if (c.email && !emails[c.sharer]) emails[c.sharer] = c.email;
  return (
    <>
      <h1>Requests</h1>
      <RequestBoard mode="list" emails={emails} />
    </>
  );
}
