export default {
  id: "hellaswag-validation",
  title: "HellaSwag Validation",
  description:
    "Checks whether a model selects the most plausible continuation from four adversarially filtered choices.",
  systemPrompt:
    "Choose the most plausible continuation. End with exactly `FINAL ANSWER: A`, `FINAL ANSWER: B`, `FINAL ANSWER: C`, or `FINAL ANSWER: D`.",
  disclosure: "public_sample",
  cases: {
    transformer: "../transformers/index.ts",
    sources: {
      validation_1: "../data/validation-1.jsonl",
      validation_2: "../data/validation-2.jsonl",
      validation_3: "../data/validation-3.jsonl",
    },
  },
  evaluate: { kind: "non_empty" },
}
