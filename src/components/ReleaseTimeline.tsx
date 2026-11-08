import { formatNear, type SubscriptionView } from "@/lib/contract";
import { TRANCHES, WEEK_MS } from "@/lib/config";

/** Number of weekly parts that have matured, same rule as the contract: floor(elapsed / week), max 4. */
export function maturedWeeks(sub: SubscriptionView, nowMs = Date.now()): number {
  const startMs = Number(BigInt(sub.start_ns) / 1_000_000n);
  return Math.max(0, Math.min(TRANCHES, Math.floor((nowMs - startMs) / WEEK_MS)));
}

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Shows the four weekly parts, what is still held in escrow, and when the next part matures. */
export function ReleaseTimeline({ sub }: { sub: SubscriptionView }) {
  const startMs = Number(BigInt(sub.start_ns) / 1_000_000n);
  const matured = maturedWeeks(sub);
  const escrow = BigInt(sub.total) - BigInt(sub.released);
  const live = sub.status === "Active" || sub.status === "Disputed";
  const part = BigInt(sub.total) / BigInt(TRANCHES);
  const nextMs = startMs + (matured + 1) * WEEK_MS;
  const weeks = Array.from({ length: TRANCHES }, (_, i) => {
    const dueMs = startMs + (i + 1) * WEEK_MS;
    const state = !live ? "settled" : i < matured ? "matured" : "locked";
    return { n: i + 1, dueMs, state };
  });
  const paused = sub.status === "Disputed";

  return (
    <div style={{ margin: "8px 0" }}>
      <div className="row" style={{ gap: 6 }}>
        {weeks.map((w) => (
          <div
            key={w.n}
            title={`Week ${w.n}: ${formatNear(part)} NEAR, matures ${fmtDate(w.dueMs)}`}
            style={{
              flex: 1,
              minWidth: 64,
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid currentColor",
              opacity: w.state === "locked" ? 0.55 : 1,
              fontSize: 12,
            }}
          >
            <strong>Week {w.n}</strong>
            <br />
            {formatNear(part)} NEAR
            <br />
            {w.state === "settled" ? "settled" : paused ? "paused" : w.state === "matured" ? "matured" : `🔒 ${fmtDate(w.dueMs)}`}
          </div>
        ))}
      </div>
      {live && (
        <p className="muted" style={{ marginBottom: 0 }}>
          Escrow balance: <strong>{formatNear(escrow)} NEAR</strong> held by the contract.{" "}
          {paused
            ? "Releases are paused until the owner resolves the dispute."
            : matured >= TRANCHES
              ? "All four weeks have matured."
              : `Next part matures ${fmtDate(nextMs)}.`}
        </p>
      )}
    </div>
  );
}
