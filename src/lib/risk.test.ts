import { test } from "node:test";
import assert from "node:assert/strict";
import { scanPost, stricter, type RiskInput } from "./risk.ts";

const clean: RiskInput = {
  title: "Stake NEAR with a validator",
  summary: "Delegate a small amount and track rewards each week.",
  steps: ["Create a wallet", "Pick a validator", "Stake a small amount"],
  risks: "Unstaking takes several days. Rewards vary and the token price can fall.",
  risk: "low",
  capitalNeededNear: 5,
};

const withText = (over: Partial<RiskInput>): RiskInput => ({ ...clean, ...over });

test("clean post passes", () => {
  const r = scanPost(clean);
  assert.equal(r.verdict, "ok");
  assert.equal(r.findings.length, 0);
});

test("asking for a seed phrase is blocked", () => {
  const r = scanPost(withText({ steps: ["Open the form", "Enter your seed phrase to verify your wallet"] }));
  assert.equal(r.verdict, "block");
  assert.ok(r.findings.some((f) => f.id === "secret-request"));
});

test("warning against sharing a seed phrase is not flagged", () => {
  const r = scanPost(withText({ risks: "Never share your seed phrase with anyone. Scammers will ask for it." }));
  assert.ok(!r.findings.some((f) => f.id === "secret-request"));
  assert.equal(r.verdict, "ok");
});

test("send funds to my wallet first is blocked", () => {
  const r = scanPost(withText({ steps: ["Send me 10 NEAR to my wallet first", "I will multiply it"] }));
  assert.equal(r.verdict, "block");
});

test("guaranteed returns raise the score", () => {
  const r = scanPost(withText({ summary: "Guaranteed profit, risk-free, you cannot lose." }));
  assert.ok(r.findings.some((f) => f.id === "guaranteed-returns"));
  assert.notEqual(r.verdict, "ok");
});

test("absurd yield is flagged but sane yield is not", () => {
  assert.ok(scanPost(withText({ summary: "Earn 5% daily on any deposit." })).findings.some((f) => f.id === "absurd-yield"));
  assert.ok(!scanPost(withText({ summary: "Validators pay about 8% yearly." })).findings.some((f) => f.id === "absurd-yield"));
});

test("recruitment and urgency stack into a block", () => {
  const r = scanPost(
    withText({ summary: "Bring friends into your downline. Act now, only 5 spots left! Presale 100x." }),
  );
  assert.equal(r.verdict, "block");
});

test("missing downside section is flagged", () => {
  const r = scanPost(withText({ risks: "none" }));
  assert.ok(r.findings.some((f) => f.id === "thin-risk-section"));
});

test("low-risk label on leveraged strategy is flagged", () => {
  const r = scanPost(withText({ summary: "Use 10x leverage on perps." }));
  assert.ok(r.findings.some((f) => f.id === "risk-label-mismatch"));
});

test("stricter never lowers a verdict", () => {
  assert.equal(stricter("block", "ok"), "block");
  assert.equal(stricter("ok", "review"), "review");
});

test("AI review is mandatory: no AI verdict means not approved", async () => {
  const { decide } = await import("./risk.ts");
  assert.equal(decide("ok", { available: false }).approved, false);
  assert.equal(decide("ok", { available: true, verdict: "ok" }).approved, true);
  assert.equal(decide("ok", { available: true, verdict: "review" }).approved, true);
  assert.equal(decide("ok", { available: true, verdict: "block" }).approved, false);
  assert.equal(decide("block", { available: true, verdict: "ok" }).approved, false);
});
