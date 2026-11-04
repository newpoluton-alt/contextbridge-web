import { z } from "zod";
import { createHash } from "node:crypto";
const text = (max = 2000) => z.string().trim().max(max);
export const explanationSchema = z.object({
  meaning: text(),
  translation: text(),
  partOfSpeech: text(80),
  lemma: text(160),
  grammar: text(),
  clue: text(),
  question: text(),
  example: text(),
  evidence: text(),
  alternatives: z.array(text()).max(5),
  check: z.object({ sentence: text(), question: text(), answer: text() }),
});
export const lookupSchema = z
  .object({
    expression: text(160)
      .min(1)
      .refine(
        (s) => s.split(/\s+/u).length <= 12,
        "Select a word or a short expression (up to 12 words).",
      ),
    sentence: text(2400).min(8),
    language: text(80).min(2),
    translationLanguage: text(80).min(2),
    mode: z.enum(["guided", "direct"]),
  })
  .refine(
    (v) =>
      normalize(v.sentence)
        .toLocaleLowerCase()
        .includes(normalize(v.expression).toLocaleLowerCase()),
    "The expression must appear in the context.",
  );
export const settingsSchema = z.object({
  name: text(100),
  learningLanguage: text(80).min(2),
  translationLanguage: text(80).min(2),
  mode: z.enum(["guided", "direct"]),
  instructions: text(2000),
  dailyGoal: z.number().int().min(1).max(100),
});
export const progressSchema = z.object({
  initialInterpretation: text(),
  revisedInterpretation: text(),
  assistance: z.array(text(80)).max(30),
  checkResponse: text(),
  unresolved: z.boolean(),
});
export const encounterInputSchema = z.object({
  expression: text(160).min(1),
  sentence: text(2400).min(8),
  language: text(80).min(2),
  translationLanguage: text(80).min(2),
  sourceUrl: text(2048).refine(
    (v) => !v || /^(https?:|file:)/i.test(v),
    "Unsupported source URL",
  ),
  mode: z.enum(["guided", "direct"]),
  explanation: explanationSchema,
  ...progressSchema.shape,
  attemptStatus: z.enum(["not_attempted", "attempted", "assisted"]).optional(),
});
export type Explanation = z.infer<typeof explanationSchema>;
export type Lookup = z.infer<typeof lookupSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export interface Encounter extends z.infer<typeof encounterInputSchema> {
  id: string;
  createdAt: string;
  updatedAt: string;
  attemptStatus: "not_attempted" | "attempted" | "assisted";
  reviewHistory?: {
    at: string;
    rating: "again" | "hard" | "good" | "easy";
    interpretation: string;
    assistance: string[];
    unresolved: boolean;
  }[];
  review: {
    dueAt: string;
    interval: number;
    repetitions: number;
    ease: number;
  };
}
export const transientContextSchema = z.object({
  expression: text(160).min(1),
  sentence: text(2400).min(8),
  language: text(80).min(2),
  translationLanguage: text(80).min(2),
  mode: z.enum(["guided", "direct"]),
  explanation: explanationSchema,
  initialInterpretation: text().default(""),
  revisedInterpretation: text().default(""),
  assistance: z.array(text(80)).max(30).default([]),
  unresolved: z.boolean().default(false),
});
export type TransientContext = z.infer<typeof transientContextSchema>;
export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  encounterId?: string;
  context?: TransientContext;
  messages: {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
  }[];
}
export const defaults: Settings = {
  name: "Reader",
  learningLanguage: "English",
  translationLanguage: "English",
  mode: "guided",
  instructions: "",
  dailyGoal: 5,
};
export function normalize(s: string) {
  return s.trim().replace(/\s+/gu, " ");
}
export function contextKey(
  v: Pick<
    Lookup,
    "expression" | "sentence" | "language" | "translationLanguage"
  >,
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        normalize(v.expression),
        normalize(v.sentence),
        v.language.toLowerCase(),
        v.translationLanguage.toLowerCase(),
      ]),
    )
    .digest("hex");
}
export function cacheKey(v: Lookup, instructions: string) {
  return createHash("sha256")
    .update(
      contextKey(v) +
        instructions +
        (process.env.OPENAI_MODEL || "gpt-4.1-mini") +
        "contextual-v3",
    )
    .digest("hex");
}
export function attemptStatus(v: {
  initialInterpretation: string;
  assistance: string[];
}) {
  if (!v.initialInterpretation.trim()) return "not_attempted";
  const attempt = v.assistance.indexOf("initial_attempt");
  const prior = attempt < 0 ? v.assistance : v.assistance.slice(0, attempt);
  return prior.some((x) => x !== "initial_attempt" && !x.startsWith("check_"))
    ? "assisted"
    : "attempted";
}
export function scheduleReview(
  previous: Encounter["review"],
  rating: "again" | "hard" | "good" | "easy",
  now = new Date(),
): Encounter["review"] {
  let { interval, repetitions, ease } = previous;
  if (rating === "again") {
    interval = 0;
    repetitions = 0;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    interval =
      rating === "hard"
        ? Math.max(1, Math.ceil(interval * 1.2))
        : rating === "easy"
          ? Math.max(4, Math.ceil(interval * ease * 1.3))
          : repetitions === 0
            ? 1
            : repetitions === 1
              ? 3
              : Math.ceil(interval * ease);
    repetitions++;
    ease = Math.max(
      1.3,
      Math.min(
        3,
        ease + (rating === "easy" ? 0.15 : rating === "hard" ? -0.15 : 0),
      ),
    );
  }
  return {
    interval,
    repetitions,
    ease,
    dueAt: new Date(
      now.getTime() +
        (rating === "again" ? 10 * 60 * 1000 : interval * 86400000),
    ).toISOString(),
  };
}
export function exportAnki(items: Encounter[]) {
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\t/g, " ")
      .replace(/\r?\n/g, "<br>");
  return (
    "#separator:Tab\n#html:true\n#columns:Front\tBack\tTags\n" +
    items
      .map((v) =>
        [
          `${escape(v.sentence)}<br><b>${escape(v.expression)}</b>`,
          `${escape(v.explanation.meaning)}<br>${escape(v.explanation.translation)}<br>${escape(v.explanation.grammar)}`,
          `ContextBridge ${v.language.replace(/[^\p{L}\p{N}_-]/gu, "_")}`,
        ].join("\t"),
      )
      .join("\n")
  );
}
