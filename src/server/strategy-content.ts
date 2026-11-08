import "server-only";
import type { RiskInput } from "@/lib/risk";
import { strategiesBySharer, type PublicStrategy } from "@/data/strategies";

// GATED CONTENT. Never import this file from a client component. In a production app this would live
// in a database; because this repository is public, treat anything here as demo content only.

export interface StrategyDetail {
  id: string;
  steps: string[];
  risks: string;
  proofWallet: string | null;
}

const DETAILS: Record<string, StrategyDetail> = {
  "demo-1": {
    id: "demo-1",
    steps: ["Create a wallet", "Pick a validator", "Stake a small amount", "Check rewards weekly"],
    risks: "Unstaking has a delay. Rewards vary. Principal can lose value if the token price falls.",
    proofWallet: null,
  },
  "demo-2": {
    id: "demo-2",
    steps: ["Get testnet funds from a faucet", "Follow the quest list", "Record each transaction"],
    risks: "No payout is guaranteed. Beware of any quest that asks for a seed phrase.",
    proofWallet: null,
  },
};

const EMPTY: StrategyDetail = { id: "", steps: [], risks: "", proofWallet: null };

export const detailFor = (id: string): StrategyDetail => DETAILS[id] ?? { ...EMPTY, id };
export const detailsForSharer = (sharer: string): StrategyDetail[] => strategiesBySharer(sharer).map((s) => detailFor(s.id));
export const stepCount = (id: string) => detailFor(id).steps.length;

/** Full text for the scam scanner. Runs on the server only. */
export function riskInputFor(s: PublicStrategy): RiskInput {
  const d = detailFor(s.id);
  return {
    title: s.title,
    summary: s.summary,
    steps: d.steps,
    risks: d.risks,
    risk: s.risk,
    capitalNeededNear: s.capitalNeededNear,
  };
}
