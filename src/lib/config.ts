export type Network = "testnet" | "mainnet";

export const NETWORK: Network =
  process.env.NEXT_PUBLIC_NEAR_NETWORK === "mainnet" ? "mainnet" : "testnet";

export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID ?? "portwell.testnet";

// Public RPC endpoints. Verify current URLs at https://docs.near.org/api/rpc/providers
export const RPC_URL =
  NETWORK === "mainnet" ? "https://rpc.mainnet.near.org" : "https://rpc.testnet.near.org";

export const YOCTO_PER_NEAR = 10n ** 24n;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const TRANCHES = 4;
