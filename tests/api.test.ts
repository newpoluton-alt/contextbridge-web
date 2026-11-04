import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
let app: any, origin: string, temp: string;
before(async () => {
  temp = await mkdtemp(join(tmpdir(), "contextbridge-test-"));
  process.env.DEMO_MODE = "true";
  process.env.NODE_ENV = "test";
  process.env.OPENAI_API_KEY = "";
  delete process.env.VERCEL;
  process.env.LOCAL_DATA_FILE = join(temp, "data.json");
  const { createApp } = await import("../src/server/app.js");
  ({ app } = await createApp());
  await app.listen(0, "127.0.0.1");
  origin = await app.getUrl();
});
after(async () => {
  await app?.close();
  await rm(temp, { recursive: true, force: true });
});
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const response = await fetch(origin + "/api" + path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}
test("config never exposes credentials and invalid bearer cannot fall back to demo", async () => {
  const cfg = await request("/config");
  assert.equal(cfg.data.demo, true);
  assert(!JSON.stringify(cfg.data).includes("OPENAI_API_KEY"));
  assert.equal(
    (
      await request("/settings", "GET", undefined, {
        Authorization: "Bearer forged",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/config", "GET", undefined, {
        Origin: "https://untrusted.example",
      })
    ).status,
    403,
  );
});
test("guided encounter save, update, scheduled review and delete", async () => {
  const { fixtureInputs } = await import("../src/server/fixtures.js");
  const input = fixtureInputs[0];
  const found = await request("/lookup", "POST", input);
  assert.equal(found.status, 201);
  assert.equal(found.data.source, "demo");
  const saved = await request("/encounters", "POST", {
    ...input,
    explanation: found.data.explanation,
    sourceUrl: "https://example.com",
    initialInterpretation: "",
    revisedInterpretation: "",
    assistance: ["reveal"],
    checkResponse: "",
    unresolved: false,
  });
  assert.equal(saved.status, 201);
  assert.equal(saved.data.attemptStatus, "not_attempted");
  const id = saved.data.id;
  const reused = await request("/lookup", "POST", { ...input, mode: "direct" });
  assert.equal(reused.data.cached, true);
  assert.deepEqual(reused.data.explanation, found.data.explanation);
  const patch = await request("/encounters/" + id, "PATCH", {
    initialInterpretation: "deal with",
  });
  assert.equal(patch.data.attemptStatus, "assisted");
  const rated = await request("/encounters/" + id + "/review", "POST", {
    rating: "good",
    interpretation: "deal with a problem",
    assistance: ["clue", "reveal"],
    unresolved: true,
  });
  assert.equal(rated.data.review.interval, 1);
  assert.equal(rated.data.initialInterpretation, "deal with");
  assert.equal(
    rated.data.reviewHistory[0].interpretation,
    "deal with a problem",
  );
  assert.deepEqual(rated.data.reviewHistory[0].assistance, ["clue", "reveal"]);
  assert.equal(rated.data.unresolved, true);
  assert.equal(
    (await request("/encounters/" + id + "/review", "POST", { rating: "easy" }))
      .status,
    409,
  );
  assert.equal((await request("/encounters/" + id, "DELETE")).status, 200);
});
test("single-use extension pairing can be revoked and cannot re-pair itself", async () => {
  const pair = await request("/extension/pair", "POST");
  const exchange = await request("/extension/exchange", "POST", {
    code: pair.data.code,
  });
  assert.equal(exchange.status, 201);
  assert(exchange.data.token.startsWith("cb_ext_"));
  assert.equal(
    (await request("/extension/exchange", "POST", { code: pair.data.code }))
      .status,
    401,
  );
  const headers = { Authorization: "Bearer " + exchange.data.token };
  assert.equal(
    (await request("/settings", "GET", undefined, headers)).status,
    200,
  );
  assert.equal(
    (await request("/extension/pair", "POST", undefined, headers)).status,
    403,
  );
  await request("/extension/token", "DELETE", undefined, headers);
  assert.equal(
    (await request("/settings", "GET", undefined, headers)).status,
    401,
  );
});
test("unknown demo contexts fail explicitly rather than inventing an explanation", async () => {
  const r = await request("/lookup", "POST", {
    expression: "book",
    sentence: "Please book a room for tomorrow.",
    language: "English",
    translationLanguage: "English",
    mode: "direct",
  });
  assert.equal(r.status, 422);
});
test("conversation persists and continues with actual messages", async () => {
  const { fixtureInputs, fixture } = await import("../src/server/fixtures.js");
  const context = {
    ...fixtureInputs[0],
    explanation: fixture(fixtureInputs[0]),
    initialInterpretation: "To speak to somebody?",
    revisedInterpretation: "",
    assistance: ["clue"],
    unresolved: false,
  };
  const before = (await request("/encounters")).data;
  const r = await request("/chats", "POST", {
    message: "Why does a singular subject use addresses?",
    context,
  });
  assert.equal(r.data.messages.length, 2);
  assert.deepEqual(r.data.context, context);
  assert.deepEqual((await request("/encounters")).data, before);
  const next = await request("/chats/" + r.data.id + "/messages", "POST", {
    message: "Can you give a clue?",
  });
  assert.equal(next.data.messages.length, 4);
  assert.deepEqual(next.data.context, context);
  await request("/chats/" + r.data.id, "DELETE");
  assert.equal((await request("/chats/" + r.data.id)).status, 404);
});
test("account verification blocks unverified, deleted and banned identities", async () => {
  const { assertVerifiedAccount } = await import("../src/server/auth.js");
  assert.throws(() => assertVerifiedAccount(undefined), /unavailable/);
  assert.throws(
    () => assertVerifiedAccount({ emailVerified: false, banned: false }),
    /Verify your email/,
  );
  assert.throws(
    () => assertVerifiedAccount({ emailVerified: true, banned: true }),
    /unavailable/,
  );
  assert.doesNotThrow(() =>
    assertVerifiedAccount({ emailVerified: true, banned: false }),
  );
});
test("lookup returns an exact older saved context before six newer expression matches without AI usage", async () => {
  const { fixtureInputs, fixture } = await import("../src/server/fixtures.js");
  const input = fixtureInputs[0];
  const ids: string[] = [];
  const usageBefore = (await request("/usage")).data;
  const record = {
    ...input,
    explanation: fixture(input),
    sourceUrl: "https://example.com/oldest-context",
    initialInterpretation: "The original interpretation must remain available.",
    revisedInterpretation: "It takes action about a problem.",
    assistance: ["initial_attempt"],
    checkResponse: "",
    unresolved: false,
  };
  try {
    const oldest = await request("/encounters", "POST", record);
    assert.equal(oldest.status, 201);
    ids.push(oldest.data.id);
    for (let index = 0; index < 6; index++) {
      const newer = await request("/encounters", "POST", {
        ...record,
        sentence: `The proposal addresses issue number ${index + 1} through new construction.`,
        initialInterpretation: "A newer encounter.",
      });
      assert.equal(newer.status, 201);
      ids.push(newer.data.id);
    }
    const all = (await request("/encounters")).data.items.filter((item: { expression: string }) => item.expression === input.expression);
    assert(!all.slice(0, 5).some((item: { id: string }) => item.id === oldest.data.id), "Fixture must place the exact encounter outside the five newest records.");
    const reused = await request("/lookup", "POST", { ...input, mode: "direct" });
    assert.equal(reused.status, 201);
    assert.equal(reused.data.cached, true);
    assert.equal(reused.data.matches[0].id, oldest.data.id);
    assert.equal(reused.data.matches[0].initialInterpretation, record.initialInterpretation);
    assert.equal(reused.data.matches.length, 5);
    assert.equal(new Set(reused.data.matches.map((item: { id: string }) => item.id)).size, 5);
    assert.deepEqual(reused.data.explanation, record.explanation);
    assert.deepEqual((await request("/usage")).data, usageBefore);
  } finally {
    for (const id of ids) await request(`/encounters/${id}`, "DELETE");
  }
});
