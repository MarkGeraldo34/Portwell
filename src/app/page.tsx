import Link from "next/link";
import { SetPriceForm } from "@/components/SetPriceForm";
import { PostChecker } from "@/components/PostChecker";

export default function Home() {
  return (
    <>
      <h1>Learn to earn crypto from people who have done it</h1>
      <p>
        <Link className="btn" href="/feed" style={{ display: "inline-block", textDecoration: "none" }}>
          Browse the feed
        </Link>
      </p>
      <PostChecker />
      <SetPriceForm />
    </>
  );
}
