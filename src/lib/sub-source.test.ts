import { test } from "node:test";
import assert from "node:assert/strict";
import { pickSource } from "./sub-source.ts";

const sub = { sharer: "sam", learner: "ann", startMs: 10_000_000 };
const posts = [
  { id: "p1", sharer: "sam", title: "Old post", ts: 1_000_000 },
  { id: "p2", sharer: "sam", title: "Newer post", ts: 5_000_000 },
  { id: "p3", sharer: "sam", title: "Posted later", ts: 20_000_000 },
  { id: "p4", sharer: "zed", title: "Someone else", ts: 9_000_000 },
];

test("picks the newest post of that sharer made before the subscription", () => {
  const s = pickSource(sub, posts, []);
  assert.equal(s?.title, "Newer post");
  assert.equal(s?.href, "/sharers/sam?post=p2");
});

test("an offer on the learner's request wins when it is newer than the posts", () => {
  const board = [{ request: { id: "7", title: "Learn staking", learner: "ann" }, offers: [{ sharer: "sam", ts: 9_000_000 }] }];
  const s = pickSource(sub, posts, board);
  assert.equal(s?.kind, "request");
  assert.equal(s?.title, "Learn staking");
  assert.equal(s?.href, "/requests/ann/7?sharer=sam");
});

test("offers to other learners or by other sharers are ignored; nothing found gives null", () => {
  const board = [{ request: { id: "8", title: "X", learner: "bob" }, offers: [{ sharer: "sam", ts: 9_000_000 }] }];
  assert.equal(pickSource(sub, [], board), null);
  assert.equal(pickSource(sub, [{ id: "p", sharer: "sam", title: "Later", ts: 99_000_000 }], []), null);
});
