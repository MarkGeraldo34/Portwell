// A sharer wrote their own post, so there is no reason to make them sign with a wallet to read it back.
// The steps and risk notes are kept in this browser at publish time (and after a first unlock on another device).
// The server still keeps the gated text encrypted for everyone else: only subscribers can get it from there.

export interface OwnContent {
  steps: string[];
  risks: string;
}

const k = (account: string, postId: string) => `portwell:own:${account}:${postId}`;

export function saveOwnPost(account: string, postId: string, c: OwnContent): void {
  try {
    window.localStorage.setItem(k(account, postId), JSON.stringify({ steps: c.steps, risks: c.risks }));
  } catch {
    /* storage blocked or full: the sharer can still unlock with the wallet */
  }
}

export function readOwnPost(account: string, postId: string): OwnContent | null {
  try {
    const raw = window.localStorage.getItem(k(account, postId));
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<OwnContent>;
    return Array.isArray(j.steps) && j.steps.every((s) => typeof s === "string") && typeof j.risks === "string" ? { steps: j.steps, risks: j.risks } : null;
  } catch {
    return null;
  }
}
