import { RPC_URLS, CONTRACT_ID, CONTRACT_CONFIGURED, YOCTO_PER_NEAR } from "./config";

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

/** Read-only contract call over JSON-RPC, trying each public server until one answers. */
export async function view<T>(method: string, args: object = {}): Promise<T> {
  if (!CONTRACT_CONFIGURED) throw new Error("Contract not configured");
  const body = JSON.stringify({
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
  });

  let lastError = "No RPC server reachable";
  for (const url of RPC_URLS) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      if (!res.ok) {
        lastError = `RPC ${url} returned ${res.status}`;
        continue;
      }
      const json = await res.json();
      if (json.error || json.result?.error) {
        // The server answered but the call failed (for example an unknown account): do not retry elsewhere.
        throw new ContractCallError(String(json.result?.error ?? JSON.stringify(json.error?.data ?? json.error)));
      }
      const bytes = Uint8Array.from(json.result.result as number[]);
      return JSON.parse(new TextDecoder().decode(bytes)) as T;
    } catch (e) {
      if (e instanceof ContractCallError) throw e;
      lastError = `Could not reach ${url}`;
    }
  }
  throw new Error(lastError);
}

class ContractCallError extends Error {}

export const getPrice = (sharer: string) => view<string | null>("get_price", { sharer });
export const getStats = (sharer: string) => view<SharerStats>("get_sharer_stats", { sharer });
export const getSubscription = (id: number) =>
  view<SubscriptionView | null>("get_subscription", { id });

/**
 * The contract has no "list by account" call, but ids are sequential from 0, so scan ids in small
 * batches until the first missing one and keep the subscriptions that involve `account`.
 */
export async function listSubscriptionsFor(account: string, max = 300): Promise<SubscriptionView[]> {
  const found: SubscriptionView[] = [];
  const BATCH = 8;
  for (let start = 0; start < max; start += BATCH) {
    const ids = Array.from({ length: BATCH }, (_, i) => start + i);
    const subs = await Promise.all(ids.map((id) => getSubscription(id)));
    for (const sub of subs) {
      if (sub && (sub.learner === account || sub.sharer === account)) found.push(sub);
    }
    if (subs.some((sub) => sub === null)) break; // ids are sequential: first gap means the end
  }
  return found;
}

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
