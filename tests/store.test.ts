import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Store as StoreType } from "../src/server/store.js";
import type { Chat } from "../src/server/schema.js";

let store: StoreType;
let folder: string;
before(async () => {
  folder = await mkdtemp(join(tmpdir(), "contextbridge-store-"));
  process.env.DEMO_MODE = "true";
  process.env.NODE_ENV = "test";
  delete process.env.VERCEL;
  process.env.LOCAL_DATA_FILE = join(folder, "data.json");
  const { Store } = await import("../src/server/store.js");
  store = new Store();
});
after(async () => {
  await store?.close();
  await rm(folder, { recursive: true, force: true });
});

async function saved(
  owner: string,
  language = "English",
  translationLanguage = "English",
) {
  const { fixtureInputs, fixture } = await import("../src/server/fixtures.js");
  const input = fixtureInputs[0];
  return store.save(owner, {
    ...input,
    language,
    translationLanguage,
    explanation: fixture(input)!,
    sourceUrl: "",
    initialInterpretation: "",
    revisedInterpretation: "",
    assistance: [],
    checkResponse: "",
    unresolved: false,
  });
}
function messages(label: string): Chat["messages"] {
  const createdAt = new Date().toISOString();
  return [
    { id: randomUUID(), role: "user", content: label, createdAt },
    {
      id: randomUUID(),
      role: "assistant",
      content: `Reply to ${label}`,
      createdAt,
    },
  ];
}

test("simultaneous settings edits preserve independent fields", async () => {
  await Promise.all([
    store.setSettings("settings-owner", { name: "A reader" }),
    store.setSettings("settings-owner", {
      instructions: "Use short examples.",
    }),
    store.setSettings("settings-owner", { dailyGoal: 12 }),
  ]);
  const result = await store.settings("settings-owner");
  assert.equal(result.name, "A reader");
  assert.equal(result.instructions, "Use short examples.");
  assert.equal(result.dailyGoal, 12);
});

test("concurrent progress and review updates preserve both learning data and scheduling", async () => {
  const encounter = await saved("progress-owner");
  await Promise.all([
    store.update("progress-owner", encounter.id, {
      initialInterpretation: "To deal with",
    }),
    store.review("progress-owner", encounter.id, "good"),
    store.update("progress-owner", encounter.id, {
      unresolved: true,
      assistance: ["clue"],
    }),
  ]);
  const result = await store.encounter("progress-owner", encounter.id);
  assert.equal(result.initialInterpretation, "To deal with");
  assert.equal(result.unresolved, true);
  assert.equal(result.attemptStatus, "assisted");
  assert.equal(result.review.interval, 1);
  assert.equal(result.review.repetitions, 1);
  await assert.rejects(
    store.update("someone-else", encounter.id, { unresolved: false }),
    /not found/i,
  );
});

test("two concurrent ratings count as one review", async () => {
  const encounter = await saved("review-owner");
  const results = await Promise.allSettled([
    store.review("review-owner", encounter.id, "good"),
    store.review("review-owner", encounter.id, "easy"),
  ]);
  assert.equal(results.filter((v) => v.status === "fulfilled").length, 1);
  assert.equal(results.filter((v) => v.status === "rejected").length, 1);
  assert.equal(
    (await store.encounter("review-owner", encounter.id)).review.repetitions,
    1,
  );
});

test("optimistic chat append rejects a stale response without losing an accepted turn", async () => {
  const now = new Date().toISOString();
  const chat = await store.saveChat("chat-owner", {
    id: randomUUID(),
    title: "A conversation",
    createdAt: now,
    updatedAt: now,
    messages: messages("first"),
  });
  const attempts = await Promise.allSettled([
    store.appendChat("chat-owner", chat.id, messages("second"), 2),
    store.appendChat("chat-owner", chat.id, messages("third"), 2),
  ]);
  assert.equal(attempts.filter((v) => v.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((v) => v.status === "rejected").length, 1);
  assert.equal((await store.chat("chat-owner", chat.id)).messages.length, 4);
  const continued = await store.appendChat(
    "chat-owner",
    chat.id,
    messages("retry"),
    4,
  );
  assert.equal(continued.messages.length, 6);
  await assert.rejects(
    store.appendChat("someone-else", chat.id, messages("intrusion"), 6),
    /not found/i,
  );
  await assert.rejects(store.saveChat("chat-owner", chat), /already exists/i);
});

test("retrieval respects owner and both language filters", async () => {
  const expected = await saved("retrieval-owner", "English", "German");
  await saved("retrieval-owner", "English", "French");
  await saved("retrieval-owner", "Dutch", "German");
  await saved("different-owner", "English", "German");
  const found = await store.retrieve(
    "retrieval-owner",
    "housing shortage",
    undefined,
    {
      language: "english",
      translationLanguage: "german",
    },
  );
  assert.deepEqual(
    found.map((v) => v.id),
    [expected.id],
  );
});

test("deleting an encounter clears only its owner’s cached explanations", async () => {
  const encounter = await saved("deletion-owner");
  const key = "a".repeat(64);
  await store.setCache("deletion-owner", key, encounter.explanation);
  await store.setCache("different-owner", key, encounter.explanation);
  await assert.rejects(
    store.remove("different-owner", encounter.id),
    /not found/i,
  );
  assert(await store.cache("deletion-owner", key));
  await store.remove("deletion-owner", encounter.id);
  assert.equal(await store.cache("deletion-owner", key), undefined);
  assert(await store.cache("different-owner", key));
  await assert.rejects(
    store.encounter("deletion-owner", encounter.id),
    /not found/i,
  );
});
