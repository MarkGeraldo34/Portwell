import { redirect } from "next/navigation";

// The feed now lives on the front page.
export default function FeedPage() {
  redirect("/");
}
