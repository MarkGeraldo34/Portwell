import { test } from "node:test";
import assert from "node:assert/strict";
import { isRequestId, validateLesson } from "./lessons.ts";

test("lessons need a title and a real body", () => {
  assert.equal(validateLesson({ title: "Hi", body: "long enough body text" }).ok, false);
  assert.equal(validateLesson({ title: "Week 1", body: "short" }).ok, false);
  assert.deepEqual(validateLesson({ title: "  Week   1 ", body: " Start by making a wallet. " }), { ok: true, value: { title: "Week 1", body: "Start by making a wallet." } });
});

test("lesson size limits", () => {
  assert.equal(validateLesson({ title: "x".repeat(121), body: "long enough body" }).ok, false);
  assert.equal(validateLesson({ title: "Week 1", body: "x".repeat(3001) }).ok, false);
});

test("request ids are plain safe strings", () => {
  assert.equal(isRequestId("1700000000000-abc"), true);
  assert.equal(isRequestId("../etc"), false);
  assert.equal(isRequestId("a/b"), false);
  assert.equal(isRequestId(5), false);
});
