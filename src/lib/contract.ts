import { RPC_URL, CONTRACT_ID, YOCTO_PER_NEAR } from "./config";

export type Status = "Active" | "Completed" | "Cancelled" | "Disputed" | "Resolved";

export interface SubscriptionView {
  id: string;
  learner: string;
  sharer: string;
  total: string;
  released: string;
  start_ns: string;
  status: Status;
}

export interface SharerStats {
  subscriptions: number;
  distinct_payers: number;
  renewals: number;
  disputes: number;
}

/** Read-only contract call over JSON-RPC. No wallet needed. */
export async function view<T>(method: string, args: object = {}): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "portwell",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "optimistic",
        account_id: CONTRACT_ID,
        method_name: method,
        args_base64: btoa(JSON.stringify(args)),
      },
    }),
  });
  const json = await res.json();
  if (json.error || json.result?.error) {
    throw new Error(json.result?.error ?? json.error?.data ?? "RPC error");
  }
  const bytes = Uint8Array.from(json.result.result as number[]);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

export const getPrice = (sharer: string) => view<string | null>("get_price", { sharer });
export const getStats = (sharer: string) => view<SharerStats>("get_sharer_stats", { sharer });
export const getSubscription = (id: number) =>
  view<SubscriptionView | null>("get_subscription", { id });

export function formatNear(yocto: string | bigint, digits = 2): string {
  const v = typeof yocto === "bigint" ? yocto : BigInt(yocto);
  const whole = v / YOCTO_PER_NEAR;
  const frac = ((v % YOCTO_PER_NEAR) * 10n ** BigInt(digits)) / YOCTO_PER_NEAR;
  return `${whole}.${frac.toString().padStart(digits, "0")}`;
}

export function parseNear(near: string): bigint {
  const [w, f = ""] = near.trim().split(".");
  const frac = (f + "0".repeat(24)).slice(0, 24);
  return BigInt(w || "0") * YOCTO_PER_NEAR + BigInt(frac || "0");
}
