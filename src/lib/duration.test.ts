import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDuration, parseDuration, validateDuration } from "./duration.ts";

test("duration needs a whole number and days or months", () => {
  assert.deepEqual(validateDuration(" 14 ", "days"), { ok: true, value: { n: 14, unit: "days" } });
  assert.equal(validateDuration("", "days").ok, false);
  assert.equal(validateDuration("0", "days").ok, false);
  assert.equal(validateDuration("1.5", "months").ok, false);
  assert.equal(validateDuration("366", "days").ok, false);
  assert.equal(validateDuration("37", "months").ok, false);
  assert.equal(validateDuration("3", "weeks").ok, false);
});

test("duration is formatted and read back safely", () => {
  assert.equal(formatDuration({ n: 1, unit: "months" }), "1 month");
  assert.equal(formatDuration({ n: 14, unit: "days" }), "14 days");
  assert.equal(parseDuration({ n: 2, unit: "months" })?.n, 2);
  assert.equal(parseDuration(undefined), null);
  assert.equal(parseDuration({ n: 9999, unit: "days" }), null);
});
