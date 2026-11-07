# PORTWELL

Built at NEAR HACKATHON (Nov 1-14, 2026). Tracks: `social`, `realworld`, `security`.

## What it is

Crypto newcomers pay a peer who already earns crypto a fixed monthly price in NEAR to learn their strategies.
The payment is held by a NEAR smart contract and released to the sharer in four weekly parts. The learner can
cancel for a refund of the unreleased parts or open a dispute that pauses releases.

## Problem

People new to crypto learn "ways to earn" from strangers online, pay up front, and have no recourse when the
advice is a scam or never arrives. Escrow with weekly release limits what any one bad sharer can take.

## How NEAR is used

- Own Rust contract (`contract/`) holds learner payments in escrow and pays sharers with native NEAR transfers.
- Learners and sharers sign in with a NEAR account (wallet selector). Payments are attached to `subscribe`.
- Sharer reputation is read from the contract: distinct payers, renewals and disputes (self-dealing through one
  account does not raise the distinct-payer count).
- The dispute owner is meant to be a Sputnik DAO account (`social` track). In this demo it is a single account.

## Try it (testnet, free funds)

Requirements: Rust (stable), Node 22+, a NEAR testnet account, `near-cli`.

1. Test the contract: `cd contract && cargo test` — expect 12 passed.
2. Build and deploy to testnet (see https://docs.near.org/ for current `cargo near` / `near-cli` commands), then
   initialise: `new` with `{"owner": "<dao-or-your-account>"}`.
3. Run the web app:
   ```
   cd web
   cp .env.example .env.local   # set NEXT_PUBLIC_CONTRACT_ID to your deployed contract
   npm install
   npm run dev
   ```
4. Open http://localhost:3000 and connect a testnet wallet. As the sharer, set a price (minimum 0.1 NEAR).
5. With a second account, open the sharer page and subscribe. See the subscription held in escrow.
6. Open "My subscriptions", enter the subscription id and press Release due after a week has passed, or press
   Cancel to see matured weeks go to the sharer and the rest refunded.

## Scam check (security track)

Every strategy post is scanned before learners see it. Posts that ask for a seed phrase, ask learners to send
funds to the sharer, promise guaranteed returns, claim absurd yields or recruit others are blocked and hidden.

- Rules scanner (`web/src/lib/risk.ts`): pattern rules with weights, a 0-100 score and a verdict of ok, review or
  block. It always runs, needs no key and is deterministic. A warning such as "never share your seed phrase"
  is not flagged; asking for one is.
- AI review (`web/src/lib/ai-review.ts`): if `NEAR_AI_API_KEY` is set, the post is also reviewed by a model on NEAR
  AI Cloud. The post is passed as untrusted data. The AI can only raise the verdict, never lower it, so a post
  cannot talk its way to "ok". If the AI is unavailable the rules result stands.
- API: `POST /api/risk` (rate limited, input size capped). UI: "Check a strategy post" on the home page, with a
  button that loads a scam example.
- Money safety comes from the contract: weekly release, learner cancel with refund, dispute that pauses release.

Try it: open the home page, press "Load a scam example", then "Run check" — see a block verdict with the matched
phrases. Run `cd web && npm test` — expect 10 passed.

## Contract rules

| Rule | Value |
| --- | --- |
| Minimum monthly price | 0.1 NEAR |
| Release schedule | 4 equal weekly parts over 30 days |
| Platform fee | 2% of each payout to a sharer |
| Learner cancel | matured weeks to sharer, rest refunded |
| Dispute | pauses releases until the owner resolves |
| Self-subscribe | rejected |

## Status and limits

- Manual renewal only. Auto-renew is future work.
- Strategy posts are static demo content in `web/src/data/strategies.ts`, not stored on-chain.
- The AI review layer is optional and needs a NEAR AI Cloud key; the rules scanner is the tested baseline.
- The scanner is pattern based and will miss novel scams. It reduces risk and does not remove it.
- The contract is unaudited. Use tiny amounts.
- Peer-shared education, not financial advice.

## Libraries

near-sdk (Rust), Next.js, React, `@near-wallet-selector/*`, `@near-js/transactions`. No code from before the
hackathon window is reused (author to confirm before submitting; list any reused code here).

## License

MIT
