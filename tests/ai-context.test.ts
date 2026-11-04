import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AI_LIMITS,
  compactEncounter,
  compactHistory,
  contextExcerpt,
  feedbackReference,
  singleFlight,
  aiCacheKey,
} from "../src/server/ai-context.js";
import { cacheKey } from "../src/server/schema.js";
import { fixtureInputs, fixture } from "../src/server/fixtures.js";
test("guided and direct lookups share cache while context, preferences and language remain distinct", () => {
  const input = fixtureInputs[0];
  assert.equal(cacheKey(input, ""), cacheKey({ ...input, mode: "direct" }, ""));
  assert.notEqual(cacheKey(input, ""), cacheKey(input, "Use simple English"));
  assert.notEqual(
    cacheKey(input, ""),
    cacheKey({ ...input, translationLanguage: "German" }, ""),
  );
  assert.notEqual(
    cacheKey(input, ""),
    cacheKey({ ...input, sentence: "The label has two addresses." }, ""),
  );
});
test("long chat history has strict bounded content and no metadata", () => {
  const messages = Array.from({ length: 40 }, (_, i) => ({
    id: String(i),
    role: i % 2 ? ("assistant" as const) : ("user" as const),
    content: String(i) + "x".repeat(6000),
    createdAt: "irrelevant",
  }));
  const compact = compactHistory(messages);
  assert(compact.length <= AI_LIMITS.historyMessages);
  assert(
    compact.reduce((n, m) => n + m.content.length, 0) <= AI_LIMITS.historyChars,
  );
  assert(compact.at(-1)?.content.startsWith("39"));
  assert(
    compact.every((v) => Object.keys(v).sort().join(",") === "content,role"),
  );
});
test("retrieval prompt keeps bounded learning context, excludes private metadata and centers the expression", () => {
  const input = fixtureInputs[0];
  const sentence =
    "x".repeat(2000) + " " + input.expression + " " + "y".repeat(2000);
  assert(contextExcerpt(sentence, input.expression).includes(input.expression));
  const compact = compactEncounter({
    ...input,
    id: "hidden",
    sentence,
    explanation: fixture(input)!,
    sourceUrl: "https://private.example",
    initialInterpretation: "private attempt",
    revisedInterpretation: "",
    assistance: [],
    checkResponse: "",
    unresolved: false,
    attemptStatus: "not_attempted",
    createdAt: "",
    updatedAt: "",
    review: { interval: 1, repetitions: 1, ease: 2.5, dueAt: "" },
  });
  assert(compact.sentence.length <= 1402);
  assert(!JSON.stringify(compact).includes("private.example"));
  assert.equal(compact.initialInterpretation, "private attempt");
  assert.equal(compact.assistanceMode, input.mode);
  assert(!("review" in compact));
});
test("check feedback retains its answer but excludes unrelated assistance", () => {
  const x = fixture(fixtureInputs[0])!;
  const reference = feedbackReference(x, "check");
  assert("check" in reference);
  assert(!("alternatives" in reference));
  assert(!("check" in feedbackReference(x, "interpretation")));
});
test("concurrent web and extension requests use one in-flight operation, not permanent result sharing", async () => {
  let calls = 0;
  const work = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 5));
    return "answer";
  };
  assert.deepEqual(
    await Promise.all([
      singleFlight("owner1:key", work),
      singleFlight("owner1:key", work),
    ]),
    ["answer", "answer"],
  );
  assert.equal(calls, 1);
  await singleFlight("owner1:key", work);
  assert.equal(calls, 2);
});
test("chat response cache distinguishes history, scope and latest question", () => {
  const a = { question: "Why?", history: [], selectedEncounter: "one" };
  assert.notEqual(
    aiCacheKey("chat", a),
    aiCacheKey("chat", { ...a, selectedEncounter: "two" }),
  );
  assert.notEqual(
    aiCacheKey("chat", a),
    aiCacheKey("chat", {
      ...a,
      history: [{ role: "user", content: "new context" }],
    }),
  );
});
