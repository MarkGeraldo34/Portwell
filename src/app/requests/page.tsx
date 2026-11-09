import { FeedTabs } from "@/components/FeedTabs";
import { RequestBoard } from "@/components/RequestBoard";

export default function RequestsPage() {
  return (
    <>
      <h1>Learn to earn crypto, anon!</h1>
      <FeedTabs active="requests" />
      <RequestBoard />
    </>
  );
}
