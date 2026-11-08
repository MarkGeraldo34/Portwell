import { notFound } from "next/navigation";
import { strategiesBySharer } from "@/data/strategies";
import { SubscribePanel } from "@/components/SubscribePanel";
import { LockedStrategies } from "@/components/LockedStrategies";
import { scanPost } from "@/lib/risk";
import { riskInputFor, stepCount } from "@/server/strategy-content";

export default async function SharerPage({ params }: { params: Promise<{ account: string }> }) {
  const { account } = await params;
  const strategies = strategiesBySharer(decodeURIComponent(account));
  if (strategies.length === 0) notFound();
  const sharer = strategies[0].sharer;
  const scanned = strategies.map((s) => ({ s, verdict: scanPost(riskInputFor(s)).verdict }));
  const shown = scanned.filter((x) => x.verdict !== "block");

  // Only teaser fields go to the browser. Steps, risks and the proof wallet come from /api/unlock.
  const teasers = shown.map(({ s, verdict }) => ({
    id: s.id,
    title: s.title,
    summary: s.summary,
    risk: s.risk,
    capitalNeededNear: s.capitalNeededNear,
    steps: stepCount(s.id),
    verdict,
  }));

  return (
    <>
      <h1>{sharer}</h1>
      <SubscribePanel sharer={sharer} />
      {shown.length < strategies.length && (
        <p className="banner">{strategies.length - shown.length} post(s) hidden by the scam check.</p>
      )}
      <LockedStrategies sharer={sharer} teasers={teasers} />
    </>
  );
}
