export type Network = "testnet" | "mainnet";

export const NETWORK: Network =
  process.env.NEXT_PUBLIC_NEAR_NETWORK === "mainnet" ? "mainnet" : "testnet";

// No default on purpose: a default account we do not control could be claimed by someone else.
export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";
export const CONTRACT_CONFIGURED = CONTRACT_ID.length > 0;

// Public RPC endpoints, tried in order until one answers. Override the first with NEXT_PUBLIC_RPC_URL.
// Current list: https://docs.near.org/api/rpc/providers
const DEFAULT_RPCS: Record<Network, string[]> = {
  testnet: ["https://test.rpc.fastnear.com", "https://near-testnet.drpc.org", "https://testnet-rpc.intea.rs"],
  mainnet: ["https://free.rpc.fastnear.com", "https://near.drpc.org"],
};
export const RPC_URLS: string[] = [
  ...(process.env.NEXT_PUBLIC_RPC_URL ? [process.env.NEXT_PUBLIC_RPC_URL] : []),
  ...DEFAULT_RPCS[NETWORK],
];

export const YOCTO_PER_NEAR = 10n ** 24n;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const TRANCHES = 4;
