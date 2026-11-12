import { test } from "node:test";
import assert from "node:assert/strict";
import { badgeText, countNewer } from "./unread.ts";

test("counts only items newer than the last visit", () => {
  assert.equal(countNewer([1, 5, 9], 5), 1);
  assert.equal(countNewer([], 0), 0);
  assert.equal(countNewer([1, 2], 0), 2);
});

test("badge text caps at 99+ and hides zero", () => {
  assert.equal(badgeText(0), "");
  assert.equal(badgeText(7), "7");
  assert.equal(badgeText(99), "99");
  assert.equal(badgeText(100), "99+");
});
