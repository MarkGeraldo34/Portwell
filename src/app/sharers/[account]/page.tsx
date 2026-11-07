import { notFound } from "next/navigation";
import { strategiesBySharer } from "@/data/strategies";
import { SubscribePanel } from "@/components/SubscribePanel";
import { RiskPanel } from "@/components/RiskPanel";
import { scanPost } from "@/lib/risk";

export default async function SharerPage({ params }: { params: Promise<{ account: string }> }) {
  const { account } = await params;
  const strategies = strategiesBySharer(decodeURIComponent(account));
  if (strategies.length === 0) notFound();
  const sharer = strategies[0].sharer;
  const shown = strategies.filter((s) => scanPost(s).verdict !== "block");

  return (
    <>
      <h1>{sharer}</h1>
      <SubscribePanel sharer={sharer} />
      {shown.length < strategies.length && (
        <p className="banner">{strategies.length - shown.length} post(s) hidden by the scam check.</p>
      )}
      {shown.map((s) => (
        <article className="card" key={s.id}>
          <h3>{s.title}</h3>
          <p>{s.summary}</p>
          <ol>
            {s.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p>
            <strong>Risk ({s.risk}):</strong> {s.risks}
          </p>
          <RiskPanel result={scanPost(s)} />
          <p className="muted">
            Proof wallet: {s.proofWallet ?? "none linked yet — treat unverified posts with extra care"}
          </p>
        </article>
      ))}
    </>
  );
}
