import type { RiskInput } from "./risk.ts";

/** Asks the server for the mandatory AI scam review. Resolves to an error message when the text may not be published. */
export async function requireAiApproval(post: RiskInput): Promise<string | null> {
  try {
    const r = await fetch("/api/risk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(post),
    });
    if (r.status === 429) return "Too many checks in a minute. Wait a moment and try again.";
    if (!r.ok) {
      const body = (await r.json().catch(() => ({}))) as { error?: string };
      const hint = r.status === 504 || r.status === 408 ? "the server timed out" : body.error ?? "unexpected server error";
      return `The scam review could not run (HTTP ${r.status}: ${hint}), so nothing was posted. Try again.`;
    }
    const d = (await r.json()) as { approved?: boolean; final?: string; ai?: { available?: boolean; reasons?: string[]; error?: string } };
    if (!d.ai?.available) {
      const why = d.ai?.error ? ` (${d.ai.error})` : "";
      return `The AI scam review is required and is unavailable right now${why}, so nothing was posted. Try again later.`;
    }
    if (!d.approved) {
      const why = d.ai.reasons?.[0];
      return `The scam review blocked this${why ? `: ${why}` : ""}. Please reword it.`;
    }
    return null;
  } catch {
    return "The scam review could not be reached, so nothing was posted. Check your connection and try again.";
  }
}
