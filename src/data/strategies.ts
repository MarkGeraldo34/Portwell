// PUBLIC teaser data only. This file is sent to every visitor, so it must never hold the steps,
// the risk write-up or the proof wallet. Those live in src/server/strategy-content.ts and are
// only returned by /api/unlock after the viewer proves they hold an active subscription.
//
// DEMO CONTENT. Replace with strategies you have verified yourself before recording the demo.

export type Risk = "low" | "medium" | "high";

export interface PublicStrategy {
  id: string;
  sharer: string; // NEAR account of the sharer
  title: string;
  summary: string; // a teaser, not the method
  capitalNeededNear: number;
  risk: Risk;
}

export const STRATEGIES: PublicStrategy[] = [
  {
    id: "demo-1",
    sharer: "portwell-sharer-babyboi34.testnet",
    title: "Example: stake NEAR with a validator",
    summary: "Placeholder post showing the template. Replace with a strategy you have run yourself.",
    capitalNeededNear: 5,
    risk: "low",
  },
  {
    id: "demo-2",
    sharer: "demo-sharer-two.testnet",
    title: "Example: complete testnet quests",
    summary: "Placeholder post. Testnet tasks cost no real money but may not pay anything.",
    capitalNeededNear: 0,
    risk: "low",
  },
];

export const strategiesBySharer = (account: string) => STRATEGIES.filter((s) => s.sharer === account);
export const sharers = () => Array.from(new Set(STRATEGIES.map((s) => s.sharer)));
