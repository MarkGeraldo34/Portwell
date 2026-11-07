// DEMO CONTENT. Replace with strategies you have verified yourself before recording the demo.
// Every post follows the same fixed template so scams cannot hide in free-form text.

export type Risk = "low" | "medium" | "high";

export interface Strategy {
  id: string;
  sharer: string; // NEAR account of the sharer
  title: string;
  summary: string;
  steps: string[];
  capitalNeededNear: number;
  risk: Risk;
  risks: string; // plain-language downside
  proofWallet: string | null; // wallet that actually executed it; shown with on-chain history
}

export const STRATEGIES: Strategy[] = [
  {
    id: "demo-1",
    sharer: "portwell-sharer-babyboi34.testnet",
    title: "Example: stake NEAR with a validator",
    summary: "Placeholder post showing the template. Replace with a strategy you have run yourself.",
    steps: ["Create a wallet", "Pick a validator", "Stake a small amount", "Check rewards weekly"],
    capitalNeededNear: 5,
    risk: "low",
    risks: "Unstaking has a delay. Rewards vary. Principal can lose value if the token price falls.",
    proofWallet: null,
  },
  {
    id: "demo-2",
    sharer: "portwell-sharer-babyboi34.testnet",
    title: "Example: complete testnet quests",
    summary: "Placeholder post. Testnet tasks cost no real money but may not pay anything.",
    steps: ["Get testnet funds from a faucet", "Follow the quest list", "Record each transaction"],
    capitalNeededNear: 0,
    risk: "low",
    risks: "No payout is guaranteed. Beware of any quest that asks for a seed phrase.",
    proofWallet: null,
  },
];

export const strategiesBySharer = (account: string) => STRATEGIES.filter((s) => s.sharer === account);
export const sharers = () => Array.from(new Set(STRATEGIES.map((s) => s.sharer)));
