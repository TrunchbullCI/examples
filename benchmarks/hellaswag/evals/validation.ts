export default {
  id: "hellaswag-validation",
  title: "HellaSwag Validation",
  description:
    "Checks whether a model selects the most plausible continuation from four adversarially filtered choices.",
  systemPrompt:
    "Choose the most plausible continuation. End with exactly `FINAL ANSWER: A`, `FINAL ANSWER: B`, `FINAL ANSWER: C`, or `FINAL ANSWER: D`.",
  cases: {
    transformer: "../transformers/index.ts",
    sources: {
      validation: "../data/validation.jsonl",
    },
  },
  evaluate: { kind: "non_empty" },
}
