// Client helper: who has written to this account in chat (names and times only), for the unread badges.
export interface ChatIncoming {
  from: string;
  ts: number;
}

export async function fetchChatIncoming(account: string): Promise<ChatIncoming[]> {
  try {
    const res = await fetch(`/api/chat/activity?account=${encodeURIComponent(account)}`, { cache: "no-store" });
    if (!res.ok) return [];
    const j = (await res.json()) as { incoming?: ChatIncoming[] };
    return (j.incoming ?? []).filter((m) => typeof m?.from === "string" && Number.isFinite(m?.ts));
  } catch {
    return [];
  }
}
