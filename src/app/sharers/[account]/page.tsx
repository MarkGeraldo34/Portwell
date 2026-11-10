import { notFound } from "next/navigation";
import { strategiesBySharer } from "@/data/strategies";
import { SubscribePanel } from "@/components/SubscribePanel";
import { LockedStrategies } from "@/components/LockedStrategies";
import { VerdictTag } from "@/components/RiskPanel";
import { scanPost } from "@/lib/risk";
import { riskInputFor, stepCount } from "@/server/strategy-content";

export default async function SharerPage({ params }: { params: Promise<{ account: string }> }) {
  const { account } = await params;
  const sharer = decodeURIComponent(account);
  // Anyone who set a price in the escrow contract can be subscribed to, even without a published strategy yet
  // (for example a sharer who answered a learner's request). Only reject things that are not NEAR account ids.
  if (!/^[a-z0-9._-]{2,64}$/.test(sharer)) notFound();
  const strategies = strategiesBySharer(sharer);
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
      {strategies.length === 0 ? (
        <section className="card">
          <p className="muted" style={{ margin: 0 }}>
            This sharer has not published a strategy post yet. You can still subscribe above: your payment is held in
            escrow and released weekly, and you can cancel for a refund of the unreleased weeks.
          </p>
        </section>
      ) : (
        <LockedStrategies sharer={sharer} teasers={teasers} />
      )}
    </>
  );
}
