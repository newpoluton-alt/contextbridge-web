export type Mode = "guided" | "direct";
export interface Explanation {
  meaning: string;
  translation: string;
  partOfSpeech: string;
  lemma: string;
  grammar: string;
  clue: string;
  question: string;
  example: string;
  evidence: string;
  alternatives: string[];
  check: { sentence: string; question: string; answer: string };
}
export interface Encounter {
  id: string;
  expression: string;
  sentence: string;
  language: string;
  translationLanguage: string;
  sourceUrl: string;
  mode: Mode;
  explanation: Explanation;
  initialInterpretation: string;
  revisedInterpretation: string;
  assistance: string[];
  checkResponse: string;
  unresolved: boolean;
  attemptStatus: "not_attempted" | "attempted" | "assisted";
  createdAt: string;
  updatedAt: string;
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
export interface Settings {
  name: string;
  learningLanguage: string;
  translationLanguage: string;
  mode: Mode;
  instructions: string;
  dailyGoal: number;
}
export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  encounterId?: string;
  context?: LearningContext;
  messages: {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
  }[];
}
export type LearningContext = Pick<
  Encounter,
  | "expression"
  | "sentence"
  | "language"
  | "translationLanguage"
  | "mode"
  | "explanation"
  | "initialInterpretation"
  | "revisedInterpretation"
  | "assistance"
  | "unresolved"
> & { id?: string };
export interface Config {
  demo: boolean;
  authUrl: string;
  aiConfigured: boolean;
  storage: "local" | "neon";
  appUrl: string;
}
export interface Lookup {
  explanation: Explanation;
  cached: boolean;
  matches: Encounter[];
  source: "ai" | "demo";
}
export type Page =
  "overview" | "library" | "learn" | "review" | "chats" | "settings";
