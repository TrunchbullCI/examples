export default {
  id: "piqa-validation",
  title: "PIQA Validation",
  description:
    "Checks whether a model selects the physically plausible solution for an everyday goal.",
  systemPrompt:
    "Choose the more physically plausible solution. End with exactly `FINAL ANSWER: A` or `FINAL ANSWER: B`.",
  cases: {
    transformer: "../transformers/index.ts",
    sources: {
      validation: "../data/validation.jsonl",
      labels: "../data/validation-labels.lst",
    },
  },
  evaluate: { kind: "non_empty" },
}
