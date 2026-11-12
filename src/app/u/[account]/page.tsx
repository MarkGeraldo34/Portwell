import { notFound } from "next/navigation";
import { Profile } from "@/components/Profile";

export default async function ProfilePage({ params }: { params: Promise<{ account: string }> }) {
  const account = decodeURIComponent((await params).account);
  if (!/^[a-z0-9._-]{2,64}$/.test(account)) notFound();
  return <Profile account={account} />;
}
