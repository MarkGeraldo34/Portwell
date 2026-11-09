import Link from "next/link";
import { STRATEGIES } from "@/data/strategies";
import { VerdictTag } from "@/components/RiskPanel";
import { scanPost } from "@/lib/risk";
import { riskInputFor, stepCount } from "@/server/strategy-content";

const short = (a: string) => (a.length > 26 ? `${a.slice(0, 12)}…${a.slice(-10)}` : a);

export default function Home() {
  const scanned = STRATEGIES.map((s) => ({ s, risk: scanPost(riskInputFor(s)) }));
  const visible = scanned.filter((x) => x.risk.verdict !== "block");
  const hidden = scanned.length - visible.length;
  return (
    <>
      <h1>Learn to earn crypto from people who have done it</h1>
      {visible.map(({ s, risk }) => (
        <article className={`post risk-${s.risk}`} key={s.id}>
          <div className="post-top">
            <h3>{s.title}</h3>
            <VerdictTag verdict={risk.verdict} />
          </div>
          <p className="post-meta">
            <span title={s.sharer}>@{short(s.sharer)}</span>
            <span className="dot">•</span>
            <span>{s.risk} risk</span>
            <span className="dot">•</span>
            <span>{s.capitalNeededNear} NEAR to start</span>
          </p>
          <p className="post-summary">{s.summary}</p>
          <div className="post-foot">
            <span className="post-lock">🔒 {stepCount(s.id)} steps</span>
            <Link className="post-cta" href={`/sharers/${s.sharer}`}>
              Subscribe →
            </Link>
          </div>
        </article>
      ))}
      {hidden > 0 && <p className="muted">{hidden} post(s) hidden by the scam check.</p>}
    </>
  );
}
