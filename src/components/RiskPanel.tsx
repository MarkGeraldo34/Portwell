import type { RiskResult, Verdict } from "@/lib/risk";

const LABEL: Record<Verdict, string> = {
  ok: "No red flags found",
  review: "Needs review",
  block: "Blocked: likely scam",
};

export function VerdictTag({ verdict }: { verdict: Verdict }) {
  return <span className={`tag verdict-${verdict}`}>{LABEL[verdict]}</span>;
}

export function RiskPanel({ result, aiReasons }: { result: RiskResult; aiReasons?: string[] }) {
  return (
    <div className="card">
      <div className="row">
        <VerdictTag verdict={result.verdict} />
        <span className="muted">score {result.score}/100</span>
      </div>
      {result.findings.length > 0 && (
        <ul>
          {result.findings.map((f) => (
            <li key={f.id}>
              {f.message}
              {f.excerpt && <span className="muted"> — “{f.excerpt}”</span>}
            </li>
          ))}
        </ul>
      )}
      {aiReasons && aiReasons.length > 0 && (
        <>
          <p className="muted">AI review (NEAR AI Cloud)</p>
          <ul className="ai-reasons">
            {aiReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
