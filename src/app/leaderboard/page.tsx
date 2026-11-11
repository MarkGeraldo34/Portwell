import { Leaderboard } from "@/components/Leaderboard";
import { loadCards, sharersOf } from "@/server/posts";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  return (
    <>
      <h1>Leaderboard</h1>
      <Leaderboard known={sharersOf(await loadCards())} />
    </>
  );
}
