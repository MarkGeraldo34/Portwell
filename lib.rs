//! PORTWELL escrow.
//!
//! A learner pays a sharer's fixed monthly price in NEAR. The contract holds the
//! funds and releases them to the sharer in four weekly tranches. The learner can
//! cancel (unmatured tranches are refunded) or open a dispute (releases pause until
//! the owner resolves it). The owner should be a DAO account (e.g. Sputnik DAO).

use near_sdk::json_types::{U128, U64};
use near_sdk::store::{IterableMap, LookupMap, LookupSet};
use near_sdk::{env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, Promise};

const WEEK_NS: u64 = 7 * 24 * 60 * 60 * 1_000_000_000;
const TRANCHES: u64 = 4;
/// Platform fee in basis points, taken from every payout to a sharer (also covers storage).
const FEE_BPS: u128 = 200;
/// Minimum monthly price: 0.1 NEAR. Discourages self-dealing and dust spam.
const MIN_PRICE: u128 = 100_000_000_000_000_000_000_000;

#[derive(BorshStorageKey)]
#[near(serializers = [borsh])]
enum StorageKey {
    Prices,
    Subs,
    Stats,
    Pairs,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Status {
    Active,
    Completed,
    Cancelled,
    Disputed,
    Resolved,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct Subscription {
    pub id: u64,
    pub learner: AccountId,
    pub sharer: AccountId,
    pub total: u128,
    pub released: u128,
    pub start_ns: u64,
    pub status: Status,
}

#[near(serializers = [json])]
pub struct SubscriptionView {
    pub id: U64,
    pub learner: AccountId,
    pub sharer: AccountId,
    pub total: U128,
    pub released: U128,
    pub start_ns: U64,
    pub status: Status,
}

impl From<&Subscription> for SubscriptionView {
    fn from(s: &Subscription) -> Self {
        Self {
            id: U64(s.id),
            learner: s.learner.clone(),
            sharer: s.sharer.clone(),
            total: U128(s.total),
            released: U128(s.released),
            start_ns: U64(s.start_ns),
            status: s.status,
        }
    }
}

/// Reputation inputs. Weighted by distinct payers so self-dealing is not rewarded.
#[near(serializers = [borsh, json])]
#[derive(Clone, Default)]
pub struct SharerStats {
    pub subscriptions: u64,
    pub distinct_payers: u64,
    pub renewals: u64,
    pub disputes: u64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    owner: AccountId,
    prices: LookupMap<AccountId, u128>,
    subs: IterableMap<u64, Subscription>,
    next_id: u64,
    stats: LookupMap<AccountId, SharerStats>,
    pairs: LookupSet<(AccountId, AccountId)>,
}

fn pay(to: &AccountId, amount: u128) {
    if amount > 0 {
        let _ = Promise::new(to.clone()).transfer(NearToken::from_yoctonear(amount));
    }
}

/// Cumulative amount owed to the sharer once `k` tranches have matured.
fn cumulative_due(total: u128, k: u64) -> u128 {
    total * (k as u128) / (TRANCHES as u128)
}

fn matured_tranches(sub: &Subscription, now: u64) -> u64 {
    let elapsed = now.saturating_sub(sub.start_ns);
    (elapsed / WEEK_NS).min(TRANCHES)
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            owner,
            prices: LookupMap::new(StorageKey::Prices),
            subs: IterableMap::new(StorageKey::Subs),
            next_id: 0,
            stats: LookupMap::new(StorageKey::Stats),
            pairs: LookupSet::new(StorageKey::Pairs),
        }
    }

    /// Sharer sets their monthly price (yoctoNEAR). Applies to new subscriptions only.
    pub fn set_price(&mut self, price: U128) {
        require!(price.0 >= MIN_PRICE, "price below minimum (0.1 NEAR)");
        self.prices.insert(env::predecessor_account_id(), price.0);
    }

    /// Learner subscribes to a sharer. Attached deposit must equal the sharer's price.
    #[payable]
    pub fn subscribe(&mut self, sharer: AccountId) -> U64 {
        let learner = env::predecessor_account_id();
        require!(learner != sharer, "cannot subscribe to yourself");
        let price = *self
            .prices
            .get(&sharer)
            .unwrap_or_else(|| env::panic_str("sharer has no price set"));
        require!(
            env::attached_deposit().as_yoctonear() == price,
            "attach exactly the sharer's monthly price"
        );

        let id = self.next_id;
        self.next_id += 1;
        self.subs.insert(
            id,
            Subscription {
                id,
                learner: learner.clone(),
                sharer: sharer.clone(),
                total: price,
                released: 0,
                start_ns: env::block_timestamp(),
                status: Status::Active,
            },
        );

        let mut stats = self.stats.get(&sharer).cloned().unwrap_or_default();
        stats.subscriptions += 1;
        let pair = (learner, sharer.clone());
        if self.pairs.contains(&pair) {
            stats.renewals += 1;
        } else {
            stats.distinct_payers += 1;
            self.pairs.insert(pair);
        }
        self.stats.insert(sharer, stats);
        U64(id)
    }

    /// Anyone may call. Pays the sharer every tranche that has matured. Returns amount released.
    pub fn release_due(&mut self, id: u64) -> U128 {
        let owner = self.owner.clone();
        let now = env::block_timestamp();
        let sub = self
            .subs
            .get_mut(&id)
            .unwrap_or_else(|| env::panic_str("no such subscription"));
        require!(sub.status == Status::Active, "subscription is not active");

        let due = cumulative_due(sub.total, matured_tranches(sub, now));
        let payable = due - sub.released;
        require!(payable > 0, "nothing due yet");
        sub.released = due;
        if sub.released == sub.total {
            sub.status = Status::Completed;
        }
        let sharer = sub.sharer.clone();
        let fee = payable * FEE_BPS / 10_000;
        pay(&sharer, payable - fee);
        pay(&owner, fee);
        U128(payable)
    }

    /// Learner cancels. Matured tranches go to the sharer, the rest is refunded.
    pub fn cancel(&mut self, id: u64) {
        let owner = self.owner.clone();
        let now = env::block_timestamp();
        let sub = self
            .subs
            .get_mut(&id)
            .unwrap_or_else(|| env::panic_str("no such subscription"));
        require!(
            env::predecessor_account_id() == sub.learner,
            "only the learner can cancel"
        );
        require!(sub.status == Status::Active, "subscription is not active");

        let due = cumulative_due(sub.total, matured_tranches(sub, now));
        let to_sharer = due - sub.released;
        let refund = sub.total - due;
        sub.released = sub.total;
        sub.status = Status::Cancelled;
        let (sharer, learner) = (sub.sharer.clone(), sub.learner.clone());
        let fee = to_sharer * FEE_BPS / 10_000;
        pay(&sharer, to_sharer - fee);
        pay(&owner, fee);
        pay(&learner, refund);
    }

    /// Learner flags the sharer. Releases pause until the owner resolves.
    pub fn dispute(&mut self, id: u64) {
        let sub = self
            .subs
            .get_mut(&id)
            .unwrap_or_else(|| env::panic_str("no such subscription"));
        require!(
            env::predecessor_account_id() == sub.learner,
            "only the learner can dispute"
        );
        require!(sub.status == Status::Active, "subscription is not active");
        sub.status = Status::Disputed;
        let sharer = sub.sharer.clone();
        let mut stats = self.stats.get(&sharer).cloned().unwrap_or_default();
        stats.disputes += 1;
        self.stats.insert(sharer, stats);
    }

    /// Owner (a DAO in production) settles a dispute: all unreleased funds go to one side.
    pub fn resolve_dispute(&mut self, id: u64, favor_learner: bool) {
        require!(
            env::predecessor_account_id() == self.owner,
            "only the owner can resolve disputes"
        );
        let owner = self.owner.clone();
        let sub = self
            .subs
            .get_mut(&id)
            .unwrap_or_else(|| env::panic_str("no such subscription"));
        require!(sub.status == Status::Disputed, "not in dispute");

        let remaining = sub.total - sub.released;
        sub.released = sub.total;
        sub.status = Status::Resolved;
        let (sharer, learner) = (sub.sharer.clone(), sub.learner.clone());
        if favor_learner {
            pay(&learner, remaining);
        } else {
            let fee = remaining * FEE_BPS / 10_000;
            pay(&sharer, remaining - fee);
            pay(&owner, fee);
        }
    }

    // ---- views ----

    pub fn get_price(&self, sharer: AccountId) -> Option<U128> {
        self.prices.get(&sharer).map(|p| U128(*p))
    }

    pub fn get_subscription(&self, id: u64) -> Option<SubscriptionView> {
        self.subs.get(&id).map(SubscriptionView::from)
    }

    pub fn get_sharer_stats(&self, sharer: AccountId) -> SharerStats {
        self.stats.get(&sharer).cloned().unwrap_or_default()
    }

    pub fn get_owner(&self) -> AccountId {
        self.owner.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    const PRICE: u128 = 4 * MIN_PRICE; // 0.4 NEAR, divisible by 4

    fn ctx(predecessor: AccountId, deposit: u128, ts: u64) {
        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(predecessor)
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(ts)
            .build());
    }

    /// owner = alice, sharer = bob, learner = charlie
    fn setup() -> (Contract, AccountId, AccountId, AccountId) {
        let (owner, sharer, learner) = (accounts(0), accounts(1), accounts(2));
        ctx(owner.clone(), 0, 0);
        let mut c = Contract::new(owner.clone());
        ctx(sharer.clone(), 0, 0);
        c.set_price(U128(PRICE));
        (c, owner, sharer, learner)
    }

    fn subscribe(c: &mut Contract, learner: &AccountId, sharer: &AccountId) -> u64 {
        ctx(learner.clone(), PRICE, 0);
        c.subscribe(sharer.clone()).0
    }

    #[test]
    fn subscribe_creates_active_subscription() {
        let (mut c, _, sharer, learner) = setup();
        let id = subscribe(&mut c, &learner, &sharer);
        let s = c.get_subscription(id).unwrap();
        assert_eq!(s.total.0, PRICE);
        assert_eq!(s.released.0, 0);
        assert_eq!(s.status, Status::Active);
        let stats = c.get_sharer_stats(sharer);
        assert_eq!((stats.subscriptions, stats.distinct_payers, stats.renewals), (1, 1, 0));
    }

    #[test]
    #[should_panic(expected = "attach exactly")]
    fn wrong_deposit_rejected() {
        let (mut c, _, sharer, learner) = setup();
        ctx(learner, PRICE - 1, 0);
        c.subscribe(sharer);
    }

    #[test]
    #[should_panic(expected = "below minimum")]
    fn price_below_minimum_rejected() {
        let (mut c, _, sharer, _) = setup();
        ctx(sharer, 0, 0);
        c.set_price(U128(MIN_PRICE - 1));
    }

    #[test]
    #[should_panic(expected = "yourself")]
    fn self_subscribe_rejected() {
        let (mut c, _, sharer, _) = setup();
        ctx(sharer.clone(), PRICE, 0);
        c.subscribe(sharer);
    }

    #[test]
    fn renewal_counts_once_per_payer() {
        let (mut c, _, sharer, learner) = setup();
        subscribe(&mut c, &learner, &sharer);
        subscribe(&mut c, &learner, &sharer);
        let stats = c.get_sharer_stats(sharer);
        assert_eq!((stats.subscriptions, stats.distinct_payers, stats.renewals), (2, 1, 1));
    }

    #[test]
    #[should_panic(expected = "nothing due")]
    fn nothing_due_before_first_week() {
        let (mut c, _, sharer, learner) = setup();
        let id = subscribe(&mut c, &learner, &sharer);
        ctx(sharer, 0, WEEK_NS - 1);
        c.release_due(id);
    }

    #[test]
    fn weekly_release_then_completion() {
        let (mut c, _, sharer, learner) = setup();
        let id = subscribe(&mut c, &learner, &sharer);
        ctx(sharer.clone(), 0, WEEK_NS);
        assert_eq!(c.release_due(id).0, PRICE / 4);
        ctx(sharer.clone(), 0, 2 * WEEK_NS + 5);
        assert_eq!(c.release_due(id).0, PRICE / 4);
        ctx(sharer, 0, 10 * WEEK_NS);
        assert_eq!(c.release_due(id).0, PRICE / 2);
        let s = c.get_subscription(id).unwrap();
        assert_eq!(s.released.0, PRICE);
        assert_eq!(s.status, Status::Completed);
    }

    #[test]
    fn cancel_midway_settles_matured_and_refunds_rest() {
        let (mut c, _, sharer, learner) = setup();
        let id = subscribe(&mut c, &learner, &sharer);
        ctx(learner, 0, 2 * WEEK_NS);
        c.cancel(id);
        let s = c.get_subscription(id).unwrap();
        assert_eq!(s.status, Status::Cancelled);
        assert_eq!(s.released.0, PRICE);
    }

    #[test]
    #[should_panic(expected = "only the learner")]
    fn only_learner_can_cancel() {
        let (mut c, _, sharer, learner) = setup();
        let id = subscribe(&mut c, &learner, &sharer);
        ctx(sharer, 0, WEEK_NS);
        c.cancel(id);
    }

    #[test]
    #[should_panic(expected = "not active")]
    fn dispute_blocks_release() {
        let (mut c, _, sharer, learner) = setup();
        let id = subscribe(&mut c, &learner, &sharer);
        ctx(learner, 0, 0);
        c.dispute(id);
        ctx(sharer, 0, WEEK_NS);
        c.release_due(id);
    }

    #[test]
    fn owner_resolves_dispute() {
        let (mut c, owner, sharer, learner) = setup();
        let id = subscribe(&mut c, &learner, &sharer);
        ctx(learner, 0, 0);
        c.dispute(id);
        assert_eq!(c.get_sharer_stats(sharer).disputes, 1);
        ctx(owner, 0, WEEK_NS);
        c.resolve_dispute(id, true);
        let s = c.get_subscription(id).unwrap();
        assert_eq!(s.status, Status::Resolved);
        assert_eq!(s.released.0, PRICE);
    }

    #[test]
    #[should_panic(expected = "only the owner")]
    fn non_owner_cannot_resolve() {
        let (mut c, _, sharer, learner) = setup();
        let id = subscribe(&mut c, &learner, &sharer);
        ctx(learner.clone(), 0, 0);
        c.dispute(id);
        ctx(learner, 0, 0);
        c.resolve_dispute(id, true);
    }
}
