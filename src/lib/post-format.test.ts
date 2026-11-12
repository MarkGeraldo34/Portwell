import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPost, normalizePost, parseCard, validateEmail, validateHandle, validateMedia, type PostInput } from "./post-format.ts";

const good: PostInput = {
  title: "Stake NEAR with a validator",
  summary: "Delegate a small amount and track rewards.",
  steps: ["Create a wallet", "  Pick a validator  ", ""],
  risks: "Unstaking takes days and the price can fall.",
  risk: "low",
  capitalNeededNear: "5",
  durationN: "2",
  durationUnit: "months",
  xHandle: "@Portwell_App",
  email: "Sam@Example.com",
  media: [{ url: "https://example.com/pic.PNG" }, { url: "https://example.com/pic.PNG" }, { url: "https://youtu.be/abc" }],
};

test("a good post is normalised", () => {
  const r = normalizePost(good);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.value.steps, ["Create a wallet", "Pick a validator"]);
  assert.equal(r.value.xHandle, "Portwell_App");
  assert.equal(r.value.email, "sam@example.com");
  assert.deepEqual(r.value.media.map((m) => m.kind), ["image", "link"]); // duplicate dropped, kinds derived
});

test("X handle and email are required and validated", () => {
  assert.equal(normalizePost({ ...good, xHandle: "" }).ok, false);
  assert.equal(normalizePost({ ...good, xHandle: "https://x.com/portwell" }).ok, false);
  assert.equal(validateHandle("a".repeat(16)).ok, false);
  assert.equal(validateHandle("bad handle").ok, false);
  assert.equal(validateHandle("@ok_1").ok, true);
  assert.equal(normalizePost({ ...good, email: "" }).ok, false);
  for (const bad of ["nope", "a@b", "a@@b.com", "a b@c.com", "a@b..com", "a@b.com,c@d.com"]) assert.equal(validateEmail(bad).ok, false, bad);
  assert.equal(validateEmail("sam+tag@mail.example.co").ok, true);
});

test("media links must be safe https links", () => {
  for (const bad of ["http://example.com/a.png", "javascript:alert(1)", "https://localhost/a.png", "https://127.0.0.1/a.png", "https://u:p@example.com/a.png", "not a url"]) {
    assert.equal(validateMedia({ url: bad }).ok, false, bad);
  }
  assert.equal(normalizePost({ ...good, media: Array.from({ length: 7 }, (_, i) => ({ url: `https://example.com/${i}.png` })) }).ok, false);
});

test("uploads must come from Portwell's own storage and be an image or video", () => {
  assert.equal(validateMedia({ url: "https://evil.com/a.png", upload: true }).ok, false);
  assert.equal(validateMedia({ url: "https://abc.public.blob.vercel-storage.com/media/x/a.mp4", upload: true }).ok, true);
  assert.equal(validateMedia({ url: "https://abc.public.blob.vercel-storage.com/media/x/a.html", upload: true }).ok, false);
});

test("hash changes when any signed field changes", async () => {
  const a = normalizePost(good);
  const b = normalizePost({ ...good, email: "other@example.com" });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.notEqual(await hashPost(a.value), await hashPost(b.value));
  if (a.ok) assert.equal(await hashPost(a.value), await hashPost(a.value));
});

test("parseCard drops malformed stored data", () => {
  assert.equal(parseCard(null), null);
  assert.equal(parseCard({ v: 1, id: "1", sharer: "a.testnet", ts: 1, title: "", summary: "x", risk: "low", capitalNeededNear: 0, steps: 1 }), null);
  const c = parseCard({ v: 1, id: "1", sharer: "a.testnet", ts: 1, title: "Hello there", summary: "A summary", risk: "low", capitalNeededNear: 0, steps: 2, xHandle: "bad handle", email: "x@y.io", media: [{ url: "http://x.com/a.png" }] });
  assert.ok(c);
  assert.equal(c?.xHandle, undefined);
  assert.equal(c?.email, "x@y.io");
  assert.equal(c?.media.length, 0);
});
