import { NETWORK, RPC_URLS, YOCTO_PER_NEAR } from "./config";
import { ACTION, REQUEST_KEY, offerKey, parseOffer, parseRequest, type OfferPost, type RawEntry, type RequestPost } from "./social-format";

// NEAR Social DB: a public on-chain contract anyone can write to. Requests live there, not in our escrow contract.
export const SOCIAL_CONTRACT = NETWORK === "mainnet" ? "social.near" : "v1.social08.testnet";

/** Attached to `set` to pay for storage. Whatever is not used is refunded (refund_unused_deposit). */
export const STORAGE_DEPOSIT = YOCTO_PER_NEAR / 50n; // 0.02 NEAR

async function viewSocial<T>(method: string, args: object): Promise<T> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: "portwell",
    method: "query",
    params: {
      request_type: "call_function",
      finality: "optimistic",
      account_id: SOCIAL_CONTRACT,
      method_name: method,
      args_base64: btoa(JSON.stringify(args)),
    },
  });
  let lastErr = "No RPC server reachable";
  for (const url of RPC_URLS) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      if (!res.ok) continue;
      const json = await res.json();
      if (json.error || json.result?.error) {
        lastErr = String(json.result?.error ?? json.error?.data ?? json.error?.message ?? "RPC error");
        continue;
      }
      return JSON.parse(new TextDecoder().decode(new Uint8Array(json.result.result))) as T;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastErr);
}

const index = (key: string, limit: number) =>
  viewSocial<RawEntry[]>("index", { action: ACTION, key, order: "desc", limit });

/** Newest learner requests first. Malformed entries are dropped. */
export async function listRequests(limit = 30): Promise<RequestPost[]> {
  const raw = await index(REQUEST_KEY, limit);
  return raw.map(parseRequest).filter((r): r is RequestPost => r !== null);
}

/** Sharers who offered to teach one request. One offer per sharer (their latest). */
export async function listOffers(learner: string, blockHeight: number): Promise<OfferPost[]> {
  const raw = await index(offerKey(learner, blockHeight), 50);
  const seen = new Set<string>();
  const out: OfferPost[] = [];
  for (const o of raw.map(parseOffer)) {
    if (!o || seen.has(o.sharer)) continue;
    seen.add(o.sharer);
    out.push(o);
  }
  return out;
}
