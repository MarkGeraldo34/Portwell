import { Leaderboard } from "@/components/Leaderboard";
import { sharers } from "@/data/strategies";

export default function LeaderboardPage() {
  return (
    <>
      <h1>Leaderboard</h1>
      <Leaderboard known={sharers()} />
    </>
  );
}
