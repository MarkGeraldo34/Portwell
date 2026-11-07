import { SubscriptionActions } from "@/components/SubscriptionActions";

export default function SubscriptionsPage() {
  return (
    <>
      <h1>My subscriptions</h1>
      <p className="muted">
        Look up a subscription by id to release due weeks, cancel for a refund of unreleased weeks, or open a
        dispute.
      </p>
      <SubscriptionActions />
    </>
  );
}
