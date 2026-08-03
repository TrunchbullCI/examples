export default {
  id: "arc-challenge",
  title: "ARC-Challenge Science Reasoning",
  description:
    "Checks whether a model can reason through challenging grade-school science questions and select the correct answer choice.",
  systemPrompt:
    "Answer the multiple-choice science question with concise reasoning, then end with exactly `FINAL ANSWER: <choice label>`.",
  cases: {
    transformer: "../transformers/index.ts",
    sources: {
      train: "../data/train.jsonl",
      validation: "../data/validation.jsonl",
      test: "../data/test.jsonl",
    },
  },
  evaluate: { kind: "non_empty" },
}
