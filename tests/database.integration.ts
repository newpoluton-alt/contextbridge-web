import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "dotenv/config";
process.env.DEMO_MODE = "false";
const { Store } = await import("../src/server/store.js");
const { fixtureInputs, fixture } = await import("../src/server/fixtures.js");
test("Neon: migration, owner isolation, vector retrieval, concurrent updates and token consumption", async () => {
  const db = new Store();
  assert(db.pool, "DATABASE_URL is required for the integration check.");
  const owner = "integration-" + randomUUID(),
    other = "integration-" + randomUUID();
  try {
    process.env.AI_DAILY_TOKEN_LIMIT = "1000";
    const reservationResults = await Promise.allSettled([
      db.reserve(owner, 700),
      db.reserve(owner, 700),
    ]);
    assert.equal(
      reservationResults.filter((v) => v.status === "fulfilled").length,
      1,
    );
    const reserved = reservationResults.find((v) => v.status === "fulfilled");
    if (reserved?.status === "fulfilled")
      await db.settle(owner, reserved.value, {
        input: 100,
        output: 20,
        cached: 80,
      });
    assert.equal((await db.usage(owner)).reservedTokens, 0);
    assert.equal((await db.usage(owner)).inputTokens, 100);
    process.env.AI_DAILY_TOKEN_LIMIT = "25000";
    const input = fixtureInputs[0];
    const data = {
      ...input,
      explanation: fixture(input)!,
      sourceUrl: "",
      initialInterpretation: "",
      revisedInterpretation: "",
      assistance: [],
      checkResponse: "",
      unresolved: false,
    };
    const embedding = Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0));
    const saved = await db.save(owner, data, embedding);
    assert.equal((await db.list(owner)).length, 1);
    assert.equal((await db.list(other)).length, 0);
    await assert.rejects(() => db.encounter(other, saved.id));
    assert.equal(
      (
        await db.retrieve(owner, "housing", embedding, {
          language: "English",
          translationLanguage: "English",
        })
      )[0].id,
      saved.id,
    );
    assert.equal((await db.retrieve(other, "housing", embedding)).length, 0);
    await Promise.all([
      db.setSettings(owner, { name: "Integration reader" }),
      db.setSettings(owner, { dailyGoal: 7 }),
    ]);
    const settings = await db.settings(owner);
    assert.equal(settings.name, "Integration reader");
    assert.equal(settings.dailyGoal, 7);
    await Promise.all([
      db.update(owner, saved.id, { unresolved: true }),
      db.update(owner, saved.id, { revisedInterpretation: "deal with" }),
    ]);
    const updated = await db.encounter(owner, saved.id);
    assert(updated.unresolved);
    assert.equal(updated.revisedInterpretation, "deal with");
    const pair = await db.pair(owner);
    const exchanged = await db.exchange(pair.code);
    assert.equal(await db.tokenOwner(exchanged.token), owner);
    await assert.rejects(() => db.exchange(pair.code));
    await db.revoke(exchanged.token);
    const now = new Date().toISOString();
    const chat = await db.saveChat(owner, {
      id: randomUUID(),
      title: "Integration test",
      messages: [],
      createdAt: now,
      updatedAt: now,
    });
    const msg = {
      id: randomUUID(),
      role: "user" as const,
      content: "A check",
      createdAt: now,
    };
    const outcomes = await Promise.allSettled([
      db.appendChat(owner, chat.id, [msg], 0),
      db.appendChat(owner, chat.id, [msg], 0),
    ]);
    assert.equal(outcomes.filter((v) => v.status === "fulfilled").length, 1);
    assert.equal((await db.chat(owner, chat.id)).messages.length, 1);
    await db.setCache(owner, "test", data.explanation);
    await db.remove(owner, saved.id);
    assert.equal(await db.cache(owner, "test"), undefined);
  } finally {
    for (const table of [
      "cb_settings",
      "cb_encounters",
      "cb_chats",
      "cb_cache",
      "cb_pair_codes",
      "cb_extension_tokens",
      "cb_usage",
    ])
      await db.pool!.query(
        `DELETE FROM ${table} WHERE owner_id = ANY($1::text[])`,
        [[owner, other]],
      );
    await db.close();
  }
});
