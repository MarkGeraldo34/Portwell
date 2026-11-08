import "server-only";
import { RPC_URLS } from "@/lib/config";
import { listSubscriptionsFor } from "@/lib/contract";
import type { Deps } from "@/lib/unlock";

/** True when `publicKey` is an access key of `accountId` on the configured network. */
async function hasKey(accountId: string, publicKey: string): Promise<boolean> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: "portwell",
    method: "query",
    params: { request_type: "view_access_key", finality: "final", account_id: accountId, public_key: publicKey },
  });
  for (const url of RPC_URLS) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      if (!res.ok) continue;
      const json = await res.json();
      // A missing key is an answer ("no"); only network trouble moves on to the next server.
      return !json.error && !json.result?.error && json.result?.permission !== undefined;
    } catch {
      continue;
    }
  }
  throw new Error("No RPC server reachable");
}

async function hasActiveSubscription(accountId: string, sharer: string): Promise<boolean> {
  const subs = await listSubscriptionsFor(accountId);
  return subs.some((s) => s.learner === accountId && s.sharer === sharer && s.status === "Active");
}

export const realDeps: Deps = { hasKey, hasActiveSubscription, now: () => Date.now() };
