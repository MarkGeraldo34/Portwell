import test from "node:test";
import assert from "node:assert/strict";
import { challengeText, checkTweet, makeCode, parseTweetUrl } from "./x-verify.ts";

test("code is stable, readable and tied to account and handle", () => {
  const a = makeCode("s", "alice.testnet", "Alice");
  assert.match(a, /^PW-[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(a, makeCode("s", "alice.testnet", "alice"));
  assert.notEqual(a, makeCode("s", "bob.testnet", "alice"));
  assert.notEqual(a, makeCode("s", "alice.testnet", "other"));
  assert.notEqual(a, makeCode("other-secret", "alice.testnet", "alice"));
  assert.ok(challengeText(a, "alice.testnet").includes(a));
});

test("tweet links: only real status links on x.com or twitter.com", () => {
  assert.deepEqual(parseTweetUrl("https://x.com/Alice_1/status/1234567890123?s=20"), { handle: "Alice_1", id: "1234567890123", canonical: "https://x.com/Alice_1/status/1234567890123" });
  assert.equal(parseTweetUrl("https://twitter.com/alice/status/1234567890/")?.handle, "alice");
  assert.equal(parseTweetUrl("https://mobile.twitter.com/alice/status/1234567890")?.handle, "alice");
  for (const bad of ["http://x.com/alice/status/1234567890", "https://evil.com/alice/status/1234567890", "https://x.com.evil.com/alice/status/1234567890", "https://x.com/alice", "https://x.com/alice/status/abc", "https://x.com/i/web/status/1234567890", "not a url", ""]) {
    assert.equal(parseTweetUrl(bad), null, bad);
  }
});

test("tweet check needs the right author and the code", () => {
  const html = '<blockquote><p lang="en" dir="ltr">Verifying my X account for Portwell on NEAR. PW-ABC234 (alice.testnet)</p>&mdash; Alice (@alice) <a href="https://twitter.com/alice/status/1">x</a></blockquote>';
  const ok = { author_url: "https://twitter.com/Alice", html };
  assert.deepEqual(checkTweet(ok, { handle: "alice", code: "PW-ABC234" }), { ok: true });
  assert.deepEqual(checkTweet({ ...ok, html: html.replace("PW-ABC234", "pw-abc234") }, { handle: "alice", code: "PW-ABC234" }), { ok: true });
  const wrongAuthor = checkTweet({ ...ok, author_url: "https://twitter.com/mallory" }, { handle: "alice", code: "PW-ABC234" });
  assert.equal(wrongAuthor.ok, false);
  const wrongCode = checkTweet(ok, { handle: "alice", code: "PW-ZZZ999" });
  assert.equal(wrongCode.ok, false);
  assert.equal(checkTweet({}, { handle: "alice", code: "PW-ABC234" }).ok, false);
  // a code split by markup must not count
  assert.equal(checkTweet({ ...ok, html: html.replace("PW-ABC234", "PW-<b>ABC</b>234") }, { handle: "alice", code: "PW-ABC234" }).ok, false);
});
