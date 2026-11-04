import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Store as StoreType } from "../src/server/store.js";

let Store: typeof StoreType;
let folder: string;
let index = 0;
const stores: StoreType[] = [];
before(async () => {
  folder = await mkdtemp(join(tmpdir(), "contextbridge-budget-"));
  process.env.DEMO_MODE = "true";
  process.env.NODE_ENV = "test";
  delete process.env.VERCEL;
  ({ Store } = await import("../src/server/store.js"));
});
after(async () => {
  await Promise.all(stores.map((store) => store.close()));
  await rm(folder, { recursive: true, force: true });
});
function createStore(requestLimit = 60, tokenLimit = 25000) {
  process.env.AI_DAILY_REQUEST_LIMIT = String(requestLimit);
  process.env.AI_DAILY_TOKEN_LIMIT = String(tokenLimit);
  process.env.LOCAL_DATA_FILE = join(folder, `store-${index++}.json`);
  const store = new Store();
  stores.push(store);
  return store;
}

test("concurrent reservations cannot overspend the daily token budget", async () => {
  const store = createStore(60, 100);
  const attempts = await Promise.allSettled(
    Array.from({ length: 8 }, () => store.reserve("reader", 30)),
  );
  const accepted = attempts.filter((v) => v.status === "fulfilled");
  assert.equal(accepted.length, 3);
  assert.equal((await store.usage("reader")).reservedTokens, 90);
  assert.equal((await store.usage("reader")).requests, 3);
  const reservation = accepted[0];
  assert.equal(reservation.status, "fulfilled");
  if (reservation.status !== "fulfilled")
    throw new Error("Expected reservation");
  await store.settle("reader", reservation.value, {
    input: 5,
    output: 5,
    cached: 50,
  });
  const usage = await store.usage("reader");
  assert.equal(usage.reservedTokens, 60);
  assert.equal(usage.inputTokens, 5);
  assert.equal(usage.outputTokens, 5);
  assert.equal(usage.cachedInputTokens, 5);
  await store.reserve("reader", 30);
  await assert.rejects(store.reserve("reader", 1), /allowance reached/);
});

test("request allowance is enforced atomically even with zero-token legacy calls", async () => {
  const store = createStore(2, 1000);
  const results = await Promise.allSettled(
    Array.from({ length: 6 }, () => store.reserve("reader")),
  );
  assert.equal(results.filter((v) => v.status === "fulfilled").length, 2);
  assert.equal((await store.usage("reader")).requests, 2);
  assert.equal((await store.usage("reader")).reservedTokens, 0);
});

test("generic response caches do not consume request or token allowance", async () => {
  const store = createStore();
  const answer = { feedback: "Look at the subject.", tags: ["grammar"] };
  await store.setCache("reader", "feedback-key", answer, 60);
  assert.deepEqual(
    await store.cache<typeof answer>("reader", "feedback-key"),
    answer,
  );
  assert.equal(await store.cache("someone-else", "feedback-key"), undefined);
  await store.setCache("reader", "expired-key", { reply: "Old response" }, 0);
  assert.equal(await store.cache("reader", "expired-key"), undefined);
  assert.deepEqual(await store.usage("reader"), {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    reservedTokens: 0,
    requestLimit: 60,
    tokenLimit: 25000,
  });
});

test("settlement attributes an overnight request to its reserved UTC day", async (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: new Date("2026-11-04T23:59:59Z"),
  });
  try {
    const store = createStore();
    const yesterday = await store.reserve("reader", 100);
    assert.equal(yesterday.day, "2026-11-04");
    t.mock.timers.setTime(new Date("2026-11-05T00:00:01Z").getTime());
    const today = await store.reserve("reader", 70);
    await store.settle("reader", yesterday, {
      input: 40,
      output: 10,
      cached: 20,
    });
    const current = await store.usage("reader");
    assert.equal(current.requests, 1);
    assert.equal(current.reservedTokens, 70);
    assert.equal(current.inputTokens, 0);
    const persisted = JSON.parse(await readFile(store.path, "utf8"));
    assert.deepEqual(persisted.usage["reader2026-11-04"], {
      requests: 1,
      inputTokens: 40,
      outputTokens: 10,
      cachedInputTokens: 20,
      reservedTokens: 0,
    });
    await store.settle("reader", today, { input: 20, output: 5, cached: 0 });
    assert.equal((await store.usage("reader")).reservedTokens, 0);
  } finally {
    t.mock.timers.reset();
  }
});

test("numeric local request counts migrate without resetting allowance", async () => {
  const store = createStore(4, 1000);
  const day = new Date().toISOString().slice(0, 10);
  await writeFile(
    store.path,
    JSON.stringify({
      settings: {},
      encounters: {},
      chats: {},
      cache: {},
      codes: {},
      tokens: {},
      usage: { ["reader" + day]: 3 },
    }),
  );
  assert.equal((await store.usage("reader")).requests, 3);
  const reservation = await store.reserve("reader", 25);
  await store.settle("reader", reservation, { input: 7, output: 3, cached: 0 });
  assert.equal((await store.usage("reader")).requests, 4);
  assert.equal((await store.usage("reader")).inputTokens, 7);
  await assert.rejects(store.reserve("reader"), /allowance reached/);
});

test("invalid counts cannot reduce a budget and conservative failures retain their cost", async () => {
  const store = createStore(60, 100);
  await assert.rejects(store.reserve("reader", -1), /non-negative/);
  await assert.rejects(store.reserve("reader", 101), /allowance reached/);
  const reservation = await store.reserve("reader", 100);
  await store.settle("reader", reservation, {
    input: reservation.reservedTokens,
    output: 0,
    cached: 0,
  });
  assert.equal((await store.usage("reader")).inputTokens, 100);
  assert.equal((await store.usage("reader")).reservedTokens, 0);
  await assert.rejects(store.reserve("reader"), /allowance reached/);
});

test("lexical retrieval ignores question boilerplate and record metadata", async () => {
  const store = createStore();
  const { fixtureInputs, fixture } = await import("../src/server/fixtures.js");
  const input = fixtureInputs[0];
  const encounter = await store.save("reader", {
    ...input,
    explanation: {
      ...fixture(input)!,
      question: "What is the secretmetadata clue?",
    },
    sourceUrl: "https://example.com/secretmetadata",
    initialInterpretation: "",
    revisedInterpretation: "",
    assistance: [],
    checkResponse: "",
    unresolved: false,
  });
  assert.deepEqual(await store.retrieve("reader", "What does this mean?"), []);
  assert.deepEqual(await store.retrieve("reader", "secretmetadata"), []);
  assert.equal(
    (
      await store.retrieve("reader", `Please explain ${encounter.expression}`)
    )[0]?.id,
    encounter.id,
  );
});
