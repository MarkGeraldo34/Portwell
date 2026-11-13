# PORTWELL

Built at NEAR HACKATHON (Nov 1-14, 2026). Tracks: `social`, `realworld`, `security`.

- **Live demo (testnet):** https://portwell.vercel.app
- **Escrow contract (testnet):** `portwell-v2-babyboi34.testnet` (owner and dispute resolver: `0xb.testnet`)
- **License:** MIT

## What it is

Crypto newcomers pay a peer who already earns crypto a fixed monthly price in NEAR to learn their strategies.
The payment is held in a NEAR smart contract and released to the sharer in four weekly parts. The learner can
cancel for a refund of the unreleased parts, or open a dispute that pauses releases until the owner resolves it.

## Problem

People new to crypto learn "ways to earn" from strangers online, pay up front, and have no recourse when the
advice is a scam or never arrives. Escrow with weekly release limits what any one bad sharer can take, and a
mandatory scam review keeps the obvious scams from being published at all.

## How NEAR is used

- **Own Rust escrow contract** (`contract/`): holds learner payments, releases weekly, refunds on cancel, pauses
  on dispute. Native NEAR transfers only. A subscription must be paid with exactly the sharer's price.
- **Wallet Selector** (Meteor, MyNearWallet): sign-in and all payments on testnet.
- **NEP-413 signed messages:** a sharer proves they own their account to publish a post or upload media, and a
  subscriber proves it to unlock the steps of a strategy. Signing is free and sends no transaction.
- **NEAR Social DB** (`v1.social08.testnet`): learners' strategy requests and sharers' offers to teach. A learner
  can delete their own request (unless a subscription is live).
- **Wallet-proven X handle:** a sharer gets a short code tied to their NEAR account, posts it from their X account and
  pastes the tweet link. The server reads the tweet and saves the handle for that wallet. Needed to publish a post
  or to offer to teach.
- **Private chat:** the learner and sharer of an active subscription can message each other. One free wallet
  signature opens it.
- **NEAR AI Cloud:** every post passes a mandatory AI scam review before it is published (see below).

## How to try it (about 5 minutes, free testnet funds)

You need two testnet accounts (create them in any NEAR testnet wallet; testnet NEAR is free from a faucet).

1. Open the live demo and press **Connect NEAR wallet** with account A (the sharer).
2. Open **Share post**. **Verify your X handle** first: enter it, press **Get my code**, post the code from that X
   account, paste the tweet link and press **Verify** (one free wallet signature). Then fill in the form (title,
   summary, steps, risks, capital needed, how long you will share it, your email). Press **Load a scam example** to
   see the review block a bad post, then publish a clean post. The capital needed is the monthly price learners
   pay; approve saving it in your wallet.
3. Open the **Feed**. Your post shows with your verified X handle, Ethos score and email icons. Handles that are
   not verified show an "Unverified X handle" tag and no Ethos score. Press **View post**.
4. Sign in with account B (the learner), open the post and press **Subscribe**. The payment is held in escrow.
5. Open **My subscriptions** (card icon at the top). Press refresh. Active subscriptions are highlighted; Refund and
   Dispute are under **More actions**; older ones are under **Inactive cards**.
6. Back on the post, press **Unlock with wallet** and sign. The steps and risks are decrypted for the active subscriber.
   As the sharer, post a **weekly update** on the same post so the learner gets something for each remaining week.
7. On **My subscriptions**, both sides can press **Chat** to ask and answer questions while the subscription is active.
8. As the learner open **Request strategy**, post a request (with how many days or months and your budget), then as the
   sharer open **All Requests**, verify your X handle and press **Offer to teach** (free, no payment). The learner
   sees it under **My Requests** and in **Notifications**.
9. A post or request can be deleted by its owner with **Delete** while nobody has a live subscription to it.

## Run it locally

Requirements: Rust (stable), Node 22+, a NEAR testnet account, `near-cli`.

```
# contract
cd contract && cargo test

# web app
cd web
cp .env.example .env.local     # fill in the values below
npm install
npm run dev                    # http://localhost:3000
npm test                       # unit tests
npm run typecheck
```

Environment variables (see `web/.env.example`):

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_NEAR_NETWORK` | `testnet` |
| `NEXT_PUBLIC_CONTRACT_ID` | the deployed escrow contract |
| `NEAR_AI_API_KEY` | the mandatory AI scam review (server side only). Without it nothing can be posted. |
| `NEAR_AI_MODEL` | optional, defaults to a NEAR AI Cloud model |
| `CONTENT_SECRET` | encrypts locked steps, updates and chat messages, and signs chat sessions and X codes (server side only) |
| Vercel Blob store (public) | storing posts and media |

Never commit keys. They belong in environment variables.

## Scam check (security track)

Every strategy post is checked before it is published, and the check cannot be skipped.

- **Rules scanner** (`web/src/lib/risk.ts`): pattern rules with weights, a 0-100 score and a verdict of ok, review
  or block. Blocks requests for a seed phrase, asking learners to send funds to the sharer, guaranteed returns,
  absurd yields and recruitment schemes. A warning such as "never share your seed phrase" is not flagged.
- **AI review** (`web/src/lib/ai-review.ts`): the post is also reviewed by a model on NEAR AI Cloud, passed as
  untrusted data. The AI can only raise the verdict, never lower it.
- **Fail closed:** if the AI review cannot run, the post is not published (`decide()` in `risk.ts`, tested).
- Endpoints: `POST /api/risk` (rate limited) and `POST /api/posts` (verifies a wallet signature bound to the post
  contents, runs the review again on the server, then stores it).
- Money safety comes from the contract: weekly release, learner cancel with refund, and a dispute that pauses release.

## What is in the repo

| Path | What |
| --- | --- |
| `contract/` | Rust escrow contract with unit tests |
| `web/src/app/` | Next.js pages and API routes (feed, share post, requests, subscriptions, notifications, leaderboard, profiles) |
| `web/src/lib/` | Pure logic with tests: risk scanner, NEP-413 verification, post format, notifications, reputation |
| `web/src/server/` | Server only: Blob storage, Ethos lookup |

## Disclosure

- **Built in the hackathon window.** The repository was created and built for NEAR HACKATHON. No other project is
  submitted by the same team.
- **AI-written code.** A large part of the code was written with Claude (Anthropic) as a coding assistant, directed
  and reviewed by the team lead.
- **Libraries.** Next.js, React, TypeScript, `@near-wallet-selector/*`, `@near-js/*`, `near-sdk` (Rust),
  `@vercel/blob`, `react-icons`. Hosting on Vercel. Reputation scores come from the public Ethos API.

## Known limits

- **Testnet only.** No mainnet funds are used.
- **The contract is open.** The scam review and the "post before you can offer" rules live in the web app; someone
  calling the contract directly can bypass them. Money safety (escrow, weekly release, refund, dispute) is enforced
  on-chain.
- **One price per sharer.** The contract stores a single price for each sharer. The site refuses to let a learner
  subscribe to a post whose capital needed differs from the sharer's current price.
- **Offers are checked in the website only.** Offers to teach are written straight to NEAR Social DB by the sharer's
  wallet, so the X-handle check on offers cannot be enforced on-chain. Offers show a "Verified" or "Unverified X"
  tag so learners can tell. Publishing a post is enforced on the server.
- **Duration and updates are not enforced by the contract.** The days or months a sharer promises, and the weekly
  updates, are shown in the app. The contract cannot hold back a weekly release for a missing update; the learner
  can refund or dispute.
- **Delete lock is per sharer.** The contract has one price and one subscription list per sharer and no post id, so
  a live subscription locks all of that sharer's posts. The request-delete lock is checked in the app only.
- **Chat is near real time.** Messages are fetched about every 3 seconds (no websockets), are limited to 500
  characters, pass the scam-rule scanner, and are stored encrypted. Only active subscriptions can chat.
- **Per-post stats are approximate.** The contract has no post id, so subscriptions, disputes and refunds are
  attributed to a post by time.
- **Single owner.** Disputes are resolved by one account (`0xb.testnet`). A Sputnik DAO would be the next step.
- **Demo strategies are public.** Strategies in the demo seed data are in this public repo; real posts are
  encrypted in storage and unlock only for subscribers.
- **X handle is proven by a tweet, the email is not.** The tweet check reads the tweet through X's public embed
  endpoint, which X can change. The email is not verified and is shown publicly on the feed. Posts made before
  verification existed show as "Unverified" until their sharer verifies.
- **Video length** (one minute) is checked in the browser only.
- **Notification dates** for subscriptions, refunds and disputes use the subscription start time because the
  contract keeps no event log.
- **Social DB entries** (requests and offers) cannot be edited once written. A learner can delete their own request;
  offers cannot be deleted.
