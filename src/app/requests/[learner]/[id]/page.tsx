import { notFound } from "next/navigation";
import { RequestOffer } from "@/components/RequestOffer";

export const dynamic = "force-dynamic";

/** The page a learner reaches from "View and subscribe": the learner's own request, and the one sharer who offered. */
export default async function RequestOfferPage({ params, searchParams }: { params: Promise<{ learner: string; id: string }>; searchParams: Promise<{ sharer?: string }> }) {
  const { learner, id } = await params;
  const { sharer } = await searchParams;
  const l = decodeURIComponent(learner);
  const s = decodeURIComponent(sharer ?? "");
  if (!/^[a-z0-9._-]{2,64}$/.test(l) || !/^\d+$/.test(id) || !/^[a-z0-9._-]{2,64}$/.test(s)) notFound();
  return <RequestOffer learner={l} id={id} sharer={s} />;
}
