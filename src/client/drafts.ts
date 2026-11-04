import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { Encounter, Explanation, LearningContext, Lookup } from "./types";

// Drafts are scoped to the signed-in account and this browser tab. Storage is
// optional: private browsing or a full quota must never prevent editing.
export function useSessionState<T>(
  key: string,
  initial: T,
  accepts?: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return initial;
      const parsed: unknown = JSON.parse(raw);
      if (accepts) return accepts(parsed) ? parsed : initial;
      if (Array.isArray(initial))
        return Array.isArray(parsed) &&
          parsed.every((x) => typeof x === "string")
          ? (parsed as T)
          : initial;
      return typeof parsed === typeof initial ? (parsed as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Keep the draft in memory. */
    }
  }, [key, value]);
  return [value, setValue];
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}
function isExplanation(value: unknown): value is Explanation {
  return (
    record(value) &&
    [
      "meaning",
      "translation",
      "partOfSpeech",
      "lemma",
      "grammar",
      "clue",
      "question",
      "example",
      "evidence",
    ].every((key) => typeof value[key] === "string") &&
    Array.isArray(value.alternatives) &&
    value.alternatives.every((x) => typeof x === "string") &&
    record(value.check) &&
    ["sentence", "question", "answer"].every(
      (key) =>
        typeof (value.check as Record<string, unknown>)[key] === "string",
    )
  );
}
export function isEncounter(value: unknown): value is Encounter {
  return (
    record(value) &&
    [
      "id",
      "expression",
      "sentence",
      "language",
      "translationLanguage",
      "sourceUrl",
      "initialInterpretation",
      "revisedInterpretation",
      "checkResponse",
      "createdAt",
      "updatedAt",
    ].every((key) => typeof value[key] === "string") &&
    isExplanation(value.explanation) &&
    (value.mode === "guided" || value.mode === "direct") &&
    Array.isArray(value.assistance) &&
    value.assistance.every((x) => typeof x === "string") &&
    typeof value.unresolved === "boolean" &&
    record(value.review) &&
    typeof value.review.dueAt === "string"
  );
}
export function isLookupOrNull(value: unknown): value is Lookup | null {
  return (
    value === null ||
    (record(value) &&
      isExplanation(value.explanation) &&
      typeof value.cached === "boolean" &&
      ["ai", "demo"].includes(String(value.source)) &&
      Array.isArray(value.matches) &&
      value.matches.every(isEncounter))
  );
}
export function isEncounterOrNull(value: unknown): value is Encounter | null {
  return value === null || isEncounter(value);
}
export function isLearningContextOrNull(
  value: unknown,
): value is LearningContext | null {
  return (
    value === null ||
    (record(value) &&
      ["expression", "sentence", "language", "translationLanguage"].every(
        (key) => typeof value[key] === "string",
      ) &&
      (value.mode === "guided" || value.mode === "direct") &&
      isExplanation(value.explanation))
  );
}
export function clearAccountDrafts(accountId: string) {
  try {
    const prefix = `contextbridge:${accountId}:`;
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    /* Storage may be unavailable. */
  }
}
