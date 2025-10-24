import test from "node:test";
import assert from "node:assert";
import {
  startServer,
  connectClient,
  onceEvent,
  connectAndExpectInit,
  assertUserList,
} from "./test-helpers.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
const ROOM = "api-contract-room";

test("init-room emitted on every connection", async (t) => {
  const port = 4060;
  const server = await startServer(port);
  t.after(() => server.kill());

  const c1 = await connectClient(port);
  t.after(() => c1.disconnect());
  const init1 = await onceEvent<void>(c1, "init-room");
  assert.strictEqual(
    init1,
    undefined,
    "first client init-room payload is undefined",
  );

  const c2 = await connectClient(port);
  t.after(() => c2.disconnect());
  const init2 = await onceEvent<void>(c2, "init-room");
  assert.strictEqual(
    init2,
    undefined,
    "second client init-room payload is undefined",
  );
});

test("room-user-change reflects full state immediately after join (no stale lists)", async (t) => {
  const port = 4061;
  const server = await startServer(port);
  t.after(() => server.kill());

  const c1 = await connectAndExpectInit(port, t);
  const list1Promise = onceEvent<string[]>(c1, "room-user-change");
  c1.emit("join-room", ROOM);
  const list1 = await list1Promise;
  assertUserList(list1, [c1.id!], "first join list");

  const c2 = await connectAndExpectInit(port, t);
  const c2ListPromise = onceEvent<string[]>(c2, "room-user-change");
  const c1UpdatedPromise = onceEvent<string[]>(c1, "room-user-change");
  c2.emit("join-room", ROOM);
  const [c2List, c1UpdatedList] = await Promise.all([
    c2ListPromise,
    c1UpdatedPromise,
  ]);
  assertUserList(c2List, [c1.id!, c2.id!], "c2 first list");
  assertUserList(c1UpdatedList, [c1.id!, c2.id!], "c1 updated list");
});
