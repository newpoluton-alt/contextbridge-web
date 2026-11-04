import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contextKey,
  lookupSchema,
  scheduleReview,
  attemptStatus,
  exportAnki,
} from "../src/server/schema.js";
import { fixtureInputs, fixture } from "../src/server/fixtures.js";
test("context identity preserves meaning-changing context and target language", () => {
  const a = fixtureInputs[0];
  assert.notEqual(
    contextKey(a),
    contextKey({ ...a, sentence: "The letter has two addresses." }),
  );
  assert.notEqual(
    contextKey(a),
    contextKey({ ...a, translationLanguage: "German" }),
  );
  assert.equal(
    contextKey(a),
    contextKey({ ...a, sentence: `  ${a.sentence}  ` }),
  );
});
test("rejects whole passage and missing selection", () => {
  assert.equal(
    lookupSchema.safeParse({ ...fixtureInputs[0], expression: "not present" })
      .success,
    false,
  );
  assert.equal(
    lookupSchema.safeParse({
      ...fixtureInputs[0],
      expression:
        "one two three four five six seven eight nine ten eleven twelve thirteen",
    }).success,
    false,
  );
});
test("a direct explanation without an attempt is not incorrect", () => {
  assert.equal(
    attemptStatus({ initialInterpretation: "", assistance: ["reveal"] }),
    "not_attempted",
  );
  assert.equal(
    attemptStatus({ initialInterpretation: "deal with", assistance: [] }),
    "attempted",
  );
  assert.equal(
    attemptStatus({ initialInterpretation: "deal with", assistance: ["clue"] }),
    "assisted",
  );
});
test("review scheduling supports learning and lapse without mastery claims", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  const old = {
    dueAt: now.toISOString(),
    interval: 0,
    repetitions: 0,
    ease: 2.5,
  };
  const first = scheduleReview(old, "good", now);
  assert.equal(first.interval, 1);
  assert.equal(first.dueAt, "2026-11-05T12:00:00.000Z");
  assert.equal(scheduleReview(first, "good", now).interval, 3);
  assert.equal(
    scheduleReview(first, "again", now).dueAt,
    "2026-11-04T12:10:00.000Z",
  );
});
test("Anki export escapes HTML and keeps fields well-formed", () => {
  const a = fixtureInputs[0];
  const out = exportAnki([
    {
      ...a,
      id: "test",
      explanation: fixture(a)!,
      sentence: "<script>alert(1)</script>\taddresses\ncontext",
      sourceUrl: "",
      initialInterpretation: "",
      revisedInterpretation: "",
      assistance: [],
      checkResponse: "",
      unresolved: false,
      attemptStatus: "not_attempted",
      createdAt: "",
      updatedAt: "",
      review: { dueAt: "", interval: 0, repetitions: 0, ease: 2.5 },
    },
  ]);
  assert(!out.includes("<script>"));
  assert(out.includes("&lt;script&gt;"));
  assert.equal(out.split("\n").at(-1)?.split("\t").length, 3);
});

test("later help does not relabel an initial unsupported attempt", () => {
  assert.equal(
    attemptStatus({
      initialInterpretation: "deal with",
      assistance: ["initial_attempt", "explanation_revealed", "check_help"],
    }),
    "attempted",
  );
  assert.equal(
    attemptStatus({
      initialInterpretation: "deal with",
      assistance: ["context_clue", "initial_attempt"],
    }),
    "assisted",
  );
});
