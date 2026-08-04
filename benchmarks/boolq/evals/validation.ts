export default {
  id: "boolq-validation",
  title: "BoolQ Validation",
  description:
    "Checks whether a model answers a natural yes-or-no question from its supplied passage.",
  systemPrompt:
    "Answer only from the supplied passage. End with exactly `FINAL ANSWER: YES` or `FINAL ANSWER: NO`.",
  cases: {
    transformer: "../transformers/index.ts",
    sources: {
      validation: "../data/validation.jsonl",
    },
  },
  evaluate: { kind: "non_empty" },
}
