import Link from "next/link";
import { STRATEGIES } from "@/data/strategies";
import { VerdictTag } from "@/components/RiskPanel";
import { scanPost } from "@/lib/risk";
import { riskInputFor, stepCount } from "@/server/strategy-content";

export default function FeedPage() {
  const scanned = STRATEGIES.map((s) => ({ s, risk: scanPost(riskInputFor(s)) }));
  const visible = scanned.filter((x) => x.risk.verdict !== "block");
  const hidden = scanned.length - visible.length;
  return (
    <>
      <h1>Feed</h1>
      {visible.map(({ s, risk }) => (
        <article className="card" key={s.id}>
          <div className="row">
            <h3 style={{ margin: 0 }}>{s.title}</h3>
            <span className="tag">risk: {s.risk}</span>
            <span className="tag">capital: {s.capitalNeededNear} NEAR</span>
            <VerdictTag verdict={risk.verdict} />
          </div>
          <p>{s.summary}</p>
          <p className="muted">By {s.sharer} · {stepCount(s.id)} steps (locked)</p>
          <Link href={`/sharers/${s.sharer}`}>View sharer and subscribe</Link>
        </article>
      ))}
      {hidden > 0 && <p className="muted">{hidden} post(s) hidden by the scam check.</p>}
    </>
  );
}
