import { notFound } from "next/navigation";
import { SubscribePanel } from "@/components/SubscribePanel";
import { LockedStrategies } from "@/components/LockedStrategies";
import { MediaGallery } from "@/components/MediaGallery";
import { SharerLinks } from "@/components/SharerLinks";
import { scanPost } from "@/lib/risk";
import { cardsBySharer } from "@/server/posts";
import { getEthos } from "@/server/ethos";

export const dynamic = "force-dynamic";

export default async function SharerPage({ params }: { params: Promise<{ account: string }> }) {
  const { account } = await params;
  const sharer = decodeURIComponent(account);
  // Anyone who set a price in the escrow contract can be subscribed to, even without a published post yet
  // (for example a sharer who answered a learner's request). Only reject things that are not NEAR account ids.
  if (!/^[a-z0-9._-]{2,64}$/.test(sharer)) notFound();
  const cards = await cardsBySharer(sharer);
  const shown = cards.filter(
    (c) => scanPost({ title: c.title, summary: c.summary, steps: [], risks: "Risks are listed in the locked section.", risk: c.risk, capitalNeededNear: c.capitalNeededNear }).verdict !== "block",
  );

  // The newest post carries the sharer's contact details.
  const latest = shown.find((c) => c.xHandle) ?? shown[0];
  const ethos = latest?.xHandle ? await getEthos(latest.xHandle) : undefined;

  // Only teaser fields go to the browser. Steps and risks come from /api/unlock after a wallet signature.
  const teasers = shown.map((c) => ({
    id: c.id,
    title: c.title,
    summary: c.summary,
    risk: c.risk,
    capitalNeededNear: c.capitalNeededNear,
    steps: c.steps,
    verdict: "ok" as const,
  }));

  return (
    <>
      <h1>{sharer}</h1>
      <SharerLinks handle={latest?.xHandle} email={latest?.email} ethos={ethos} />
      <SubscribePanel sharer={sharer} />
      {shown.length < cards.length && <p className="banner">{cards.length - shown.length} post(s) hidden by the scam check.</p>}
      {shown.length === 0 ? (
        <section className="card">
          <p className="muted" style={{ margin: 0 }}>
            This sharer has not published a strategy post yet. You can still subscribe above: your payment is held in
            escrow and released weekly, and you can cancel for a refund of the unreleased weeks.
          </p>
        </section>
      ) : (
        <>
          {shown.map((c) => c.media.length > 0 && (
            <section key={c.id} className="media-block">
              <h3 className="media-title">{c.title}</h3>
              <MediaGallery media={c.media} />
            </section>
          ))}
          <LockedStrategies sharer={sharer} teasers={teasers} />
        </>
      )}
    </>
  );
}
