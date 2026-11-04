import type { Explanation, Lookup } from "./schema.js";
export const fixtureInputs: Lookup[] = [
  {
    expression: "addresses",
    sentence:
      "The proposal addresses the housing shortage by funding new construction.",
    language: "English",
    translationLanguage: "English",
    mode: "guided",
  },
  {
    expression: "take into account",
    sentence: "We need to take into account the needs of local residents.",
    language: "English",
    translationLanguage: "English",
    mode: "guided",
  },
  {
    expression: "nachhaltig",
    sentence: "Wir möchten unsere Stadt nachhaltig gestalten.",
    language: "German",
    translationLanguage: "English",
    mode: "guided",
  },
];
export function fixture(input: Lookup): Explanation | undefined {
  const i = fixtureInputs.findIndex(
    (v) =>
      v.expression === input.expression &&
      v.sentence === input.sentence &&
      v.language.toLowerCase() === input.language.toLowerCase() &&
      input.translationLanguage.toLowerCase() === "english",
  );
  if (i === 0)
    return {
      meaning:
        "To take action to deal with an issue. This does not necessarily mean solving it completely.",
      translation: "takes action to deal with",
      partOfSpeech: "verb",
      lemma: "address",
      grammar:
        "Addresses is the present simple verb with the singular subject “the proposal”. The housing shortage is its object.",
      clue: "Look at “by funding new construction”: it tells you how the proposal acts on the problem.",
      question:
        "What does funding new construction do about a housing shortage?",
      example: "The report addresses the problem but offers no solution.",
      evidence:
        "“By funding new construction” describes an action intended to respond to the shortage.",
      alternatives: [
        "Address can also mean a location, or speaking to an audience. Those senses do not fit this action.",
      ],
      check: {
        sentence: "The report addresses the problem but offers no solution.",
        question: "Does “addresses” imply that the problem is solved here?",
        answer:
          "No. It means the report deals with or discusses the problem, without necessarily solving it.",
      },
    };
  if (i === 1)
    return {
      meaning: "To consider something when making a decision.",
      translation: "consider",
      partOfSpeech: "verb phrase",
      lemma: "take into account",
      grammar:
        "The object can follow “take into account” or appear between “take” and “into account”.",
      clue: "The sentence says the residents’ needs should affect what happens next.",
      question: "What role should the residents’ needs play in the decision?",
      example: "The plan takes travel time into account.",
      evidence:
        "The object is “the needs of local residents”: the factor that should influence the decision.",
      alternatives: [],
      check: {
        sentence: "The budget takes rising prices into account.",
        question: "What has influenced this budget?",
        answer: "Rising prices were considered when preparing the budget.",
      },
    };
  if (i === 2)
    return {
      meaning:
        "In a way that can continue over time while protecting resources.",
      translation: "sustainably",
      partOfSpeech: "adverb",
      lemma: "nachhaltig",
      grammar:
        "Here nachhaltig modifies gestalten and describes how the city should be developed.",
      clue: "The expression describes how the city should be shaped, rather than naming an object.",
      question:
        "Is nachhaltig describing the city itself or the way people want to develop it?",
      example: "Wir nutzen die Ressourcen nachhaltig.",
      evidence:
        "Nachhaltig appears with gestalten and describes the manner of development.",
      alternatives: [
        "In other contexts nachhaltig can describe a lasting effect.",
      ],
      check: {
        sentence: "Das Unternehmen produziert nachhaltig.",
        question: "What does nachhaltig describe in this sentence?",
        answer: "It describes the way the company produces its goods.",
      },
    };
}
