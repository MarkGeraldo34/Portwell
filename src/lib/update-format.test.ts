import { test } from "node:test";
import assert from "node:assert/strict";
import { cadence, hashUpdate, validateUpdate, WEEK } from "./update-format.ts";

test("an update needs a post, a title and a real body", () => {
  assert.equal(validateUpdate({ postId: "bad", title: "Week 2", body: "Long enough text here" }).ok, false);
  assert.equal(validateUpdate({ postId: "123-abc", title: "", body: "Long enough text here" }).ok, false);
  assert.equal(validateUpdate({ postId: "123-abc", title: "Week 2", body: "short" }).ok, false);
  const ok = validateUpdate({ postId: "123-abc", title: " Week   2 ", body: "Long enough text here" });
  assert.ok(ok.ok);
  if (ok.ok) assert.equal(ok.value.title, "Week 2");
});

test("the hash changes when any part of the update changes", async () => {
  const a = await hashUpdate({ postId: "1-a", title: "t", body: "b" });
  assert.equal(a, await hashUpdate({ postId: "1-a", title: "t", body: "b" }));
  assert.notEqual(a, await hashUpdate({ postId: "1-a", title: "t", body: "c" }));
});

test("a sharer owes one update per further week that has passed, at most three", () => {
  const start = 1_000_000;
  assert.deepEqual(cadence(start, [], start + 3 * 24 * 3600 * 1000, 4), { owed: 0, posted: 0, behind: 0 });
  assert.deepEqual(cadence(start, [], start + WEEK, 4), { owed: 1, posted: 0, behind: 1 });
  assert.deepEqual(cadence(start, [start + WEEK + 5], start + WEEK + 10, 4), { owed: 1, posted: 1, behind: 0 });
  assert.equal(cadence(start, [], start + 10 * WEEK, 4).owed, 3);
  assert.equal(cadence(start, [start - 5], start + 2 * WEEK, 4).posted, 0); // an update from before the subscription does not count
});
