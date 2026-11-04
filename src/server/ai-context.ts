import { createHash } from "node:crypto";
import type {
  Chat,
  Encounter,
  Explanation,
  TransientContext,
} from "./schema.js";
export const AI_LIMITS = {
  lookupOutput: 900,
  feedbackOutput: 250,
  chatOutput: 500,
  historyChars: 4000,
  historyMessages: 6,
  related: 3,
  embeddingChars: 1800,
} as const;
export const clip = (value: string, length: number) =>
  value.length > length ? value.slice(0, length - 1) + "…" : value;
export function contextExcerpt(
  sentence: string,
  expression: string,
  max = 1400,
) {
  if (sentence.length <= max) return sentence;
  const index = Math.max(
    0,
    sentence.toLocaleLowerCase().indexOf(expression.toLocaleLowerCase()),
  );
  const start = Math.max(
    0,
    Math.min(index - Math.floor(max / 3), sentence.length - max),
  );
  return (
    (start ? "…" : "") +
    sentence.slice(start, start + max) +
    (start + max < sentence.length ? "…" : "")
  );
}
export function compactEncounter(item: Encounter | TransientContext) {
  return {
    expression: item.expression,
    sentence: contextExcerpt(item.sentence, item.expression),
    language: item.language,
    meaning: clip(item.explanation.meaning, 550),
    assistanceMode: item.mode,
    initialInterpretation: clip(item.initialInterpretation, 300),
    revisedInterpretation: clip(item.revisedInterpretation, 300),
    assistance: item.assistance.slice(-10),
    unresolved: item.unresolved,
    grammar: clip(item.explanation.grammar, 450),
    evidence: clip(item.explanation.evidence, 350),
  };
}
export function compactHistory(messages: Chat["messages"] = []) {
  const result: { role: "user" | "assistant"; content: string }[] = [];
  let remaining: number = AI_LIMITS.historyChars;
  for (const message of messages.slice(-AI_LIMITS.historyMessages).reverse()) {
    if (remaining <= 0) break;
    const content = clip(message.content, Math.min(1600, remaining));
    result.unshift({ role: message.role, content });
    remaining -= content.length;
  }
  return result;
}
export function feedbackReference(explanation: Explanation, kind?: string) {
  return kind === "check"
    ? { meaning: clip(explanation.meaning, 550), check: explanation.check }
    : {
        meaning: clip(explanation.meaning, 550),
        evidence: clip(explanation.evidence, 500),
        grammar: clip(explanation.grammar, 450),
      };
}
export function aiCacheKey(task: string, data: unknown) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        "contextual-v3",
        process.env.OPENAI_MODEL || "gpt-4.1-mini",
        task,
        data,
      ]),
    )
    .digest("hex");
}
const pending = new Map<string, Promise<unknown>>();
export function singleFlight<T>(
  key: string,
  work: () => Promise<T>,
): Promise<T> {
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;
  const promise = work().finally(() => {
    pending.delete(key);
  });
  pending.set(key, promise);
  return promise;
}
