import { test } from "node:test";
import assert from "node:assert/strict";
import { filterItems, pageNumbers, paginate } from "./list-tools.ts";

test("search matches every typed word, in any order, ignoring case", () => {
  const items = ["Staking basics by sam.testnet", "Airdrop hunting by eve.testnet", "Staking for kids by eve.testnet"];
  assert.deepEqual(filterItems(items, "", (x) => x), items);
  assert.deepEqual(filterItems(items, "STAKING", (x) => x).length, 2);
  assert.deepEqual(filterItems(items, "eve staking", (x) => x), ["Staking for kids by eve.testnet"]);
  assert.deepEqual(filterItems(items, "nothing", (x) => x), []);
});

test("pagination slices, clamps and reports the range", () => {
  const items = Array.from({ length: 23 }, (_, i) => i + 1);
  const p1 = paginate(items, 1, 10);
  assert.deepEqual([p1.from, p1.to, p1.total, p1.pageCount], [1, 10, 23, 3]);
  const p3 = paginate(items, 3, 10);
  assert.deepEqual([p3.from, p3.to, p3.slice.length], [21, 23, 3]);
  assert.equal(paginate(items, 99, 10).page, 3);
  assert.equal(paginate(items, 0, 10).page, 1);
  const empty = paginate([], 1, 10);
  assert.deepEqual([empty.from, empty.to, empty.pageCount], [0, 0, 1]);
});

test("page numbers collapse long ranges", () => {
  assert.deepEqual(pageNumbers(1, 3), [1, 2, 3]);
  assert.deepEqual(pageNumbers(5, 10), [1, "…", 4, 5, 6, "…", 10]);
  assert.deepEqual(pageNumbers(1, 1), [1]);
});
