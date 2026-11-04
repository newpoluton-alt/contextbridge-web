import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "dotenv/config";
process.env.DEMO_MODE = "false";
const { store } = await import("../src/server/store.js");
const { lookup, embed, chatResponse, feedback } =
  await import("../src/server/ai.js");
const { fixtureInputs } = await import("../src/server/fixtures.js");
test("live OpenAI: structured explanation, cross-mode cache, embedding and economical contextual chat", async () => {
  assert(process.env.OPENAI_API_KEY, "OpenAI API key is required.");
  assert(store.pool, "Neon database is required.");
  const owner = "ai-check-" + randomUUID();
  try {
    const input = fixtureInputs[0];
    const first = await lookup(owner, input);
    assert.equal(first.source, "ai");
    assert.equal(first.cached, false);
    assert(first.explanation.meaning.length > 0);
    const before = await store.usage(owner);
    const second = await lookup(owner, { ...input, mode: "direct" });
    assert.equal(second.cached, true);
    assert.deepEqual(second.explanation, first.explanation);
    assert.equal((await store.usage(owner)).requests, before.requests);
    const vector = await embed(owner, `${input.expression}: ${input.sentence}`);
    assert.equal(vector?.length, 1536);
    const item = await store.save(
      owner,
      {
        ...input,
        explanation: first.explanation,
        sourceUrl: "",
        initialInterpretation: "takes action about a problem",
        revisedInterpretation: "",
        assistance: ["initial_attempt"],
        checkResponse: "",
        unresolved: false,
      },
      vector,
    );
    const prechat = await store.usage(owner);
    const question = "Why does addresses end with s in my saved example?";
    const reply = await chatResponse(owner, question, undefined, item.id);
    assert(reply.reply.length > 20);
    assert(reply.title.length > 0);
    const postchat = await store.usage(owner);
    assert.equal(
      postchat.requests - prechat.requests,
      1,
      "selected-context chat must skip query embeddings",
    );
    await chatResponse(owner, question, undefined, item.id);
    assert.equal(
      (await store.usage(owner)).requests,
      postchat.requests,
      "exact retry must reuse cached answer",
    );
    const answer = await feedback(owner, {
      expression: input.expression,
      sentence: input.sentence,
      interpretation: "It means the proposal tries to deal with the problem.",
      explanation: first.explanation,
    });
    assert(answer.feedback.length > 20);
    const usage = await store.usage(owner);
    assert.equal(usage.reservedTokens, 0);
    console.log(
      JSON.stringify({
        verified: "Live explanation, cache reuse, embedding, chat and feedback",
        requests: usage.requests,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cachedInputTokens: usage.cachedInputTokens,
      }),
    );
  } finally {
    for (const table of [
      "cb_settings",
      "cb_encounters",
      "cb_chats",
      "cb_cache",
      "cb_usage",
    ])
      await store.pool!.query(`DELETE FROM ${table} WHERE owner_id=$1`, [
        owner,
      ]);
    await store.close();
  }
});
