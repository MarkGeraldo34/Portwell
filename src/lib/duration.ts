// How long a sharer will share a strategy, or how long a learner wants to pay for one. Pure helpers (no network).
export type DurationUnit = "days" | "months";
export interface Duration {
  n: number;
  unit: DurationUnit;
}

export const DURATION_MAX = { days: 365, months: 36 } as const;

type Valid = { ok: true; value: Duration } | { ok: false; error: string };

export function validateDuration(nText: unknown, unit: unknown): Valid {
  if (unit !== "days" && unit !== "months") return { ok: false, error: "Choose days or months for the duration." };
  const text = typeof nText === "string" ? nText.trim() : "";
  if (!/^\d{1,3}$/.test(text)) return { ok: false, error: "Enter how long as a whole number, e.g. 14 days or 2 months." };
  const n = Number(text);
  if (n < 1) return { ok: false, error: "The duration must be at least 1." };
  if (n > DURATION_MAX[unit]) return { ok: false, error: `The duration can be at most ${DURATION_MAX[unit]} ${unit}.` };
  return { ok: true, value: { n, unit } };
}

/** Reads a stored duration back; returns null for old entries that have none. */
export function parseDuration(raw: unknown): Duration | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const v = validateDuration(String(r.n ?? ""), r.unit);
  return v.ok ? v.value : null;
}

export const formatDuration = (d: Duration): string => `${d.n} ${d.n === 1 ? d.unit.slice(0, -1) : d.unit}`;
