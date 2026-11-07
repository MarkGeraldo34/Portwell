import Link from "next/link";
import { STRATEGIES } from "@/data/strategies";
import { SetPriceForm } from "@/components/SetPriceForm";
import { PostChecker } from "@/components/PostChecker";
import { VerdictTag } from "@/components/RiskPanel";
import { scanPost } from "@/lib/risk";

export default function Home() {
  const scanned = STRATEGIES.map((s) => ({ s, risk: scanPost(s) }));
  const visible = scanned.filter((x) => x.risk.verdict !== "block");
  const hidden = scanned.length - visible.length;
  return (
    <>
      <h1>Learn to earn crypto from people who have done it</h1>
      <p className="muted">
        Every strategy uses the same template: steps, capital needed, risk level and the wallet that ran it.
      </p>
      {visible.map(({ s, risk }) => (
        <article className="card" key={s.id}>
          <div className="row">
            <h3 style={{ margin: 0 }}>{s.title}</h3>
            <span className="tag">risk: {s.risk}</span>
            <span className="tag">capital: {s.capitalNeededNear} NEAR</span>
            <VerdictTag verdict={risk.verdict} />
          </div>
          <p>{s.summary}</p>
          <p className="muted">By {s.sharer}</p>
          <Link href={`/sharers/${s.sharer}`}>View sharer and subscribe</Link>
        </article>
      ))}
      {hidden > 0 && <p className="muted">{hidden} post(s) hidden by the scam check.</p>}
      <PostChecker />
      <SetPriceForm />
    </>
  );
}
