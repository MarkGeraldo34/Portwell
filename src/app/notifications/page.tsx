import { Notifications } from "@/components/Notifications";

export default function NotificationsPage() {
  return (
    <>
      <h1>Notifications</h1>
      <p className="muted">Offers on your requests, new subscriptions, refunds and disputes.</p>
      <Notifications />
    </>
  );
}
