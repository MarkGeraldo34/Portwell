import { NextResponse } from "next/server";
import { makeToken, TOKEN_MS } from "@/lib/chat";
import { verifyProof, type Proof } from "@/lib/publish-auth";
import { isAccountId } from "@/lib/unlock";
import { realDeps } from "@/server/access";
import { blobConfigured, blobProblem, chatSecret } from "@/server/blob-store";

/** Opens a chat: the wallet signs once (free), and only the learner or the sharer of an ACTIVE subscription gets a one-hour token. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { sharer?: string; learner?: string; auth?: Proof } | null;
  if (!body || !isAccountId(body.sharer) || !isAccountId(body.learner) || !body.auth) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (!blobConfigured()) return NextResponse.json({ error: `Chat is not available: ${blobProblem()}.` }, { status: 503 });

  let proof;
  try {
    proof = await verifyProof(body.auth, "chat", realDeps, `${body.sharer}|${body.learner}`);
  } catch {
    return NextResponse.json({ error: "Could not verify your wallet right now. Try again." }, { status: 503 });
  }
  if (!proof.ok) return NextResponse.json({ error: proof.error }, { status: proof.status });
  if (proof.accountId !== body.sharer && proof.accountId !== body.learner) return NextResponse.json({ error: "Only the learner and the sharer can use this chat." }, { status: 403 });

  try {
    if (!(await realDeps.hasActiveSubscription(body.learner, body.sharer))) {
      return NextResponse.json({ error: "Chat opens when the learner has an active subscription to this sharer." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Could not check the subscription right now. Try again." }, { status: 503 });
  }
  const exp = Date.now() + TOKEN_MS;
  return NextResponse.json({ token: makeToken(chatSecret(), { sharer: body.sharer, learner: body.learner, account: proof.accountId, exp }), exp });
}
