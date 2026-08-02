export default {
  id: "arc-challenge-mini",
  title: "ARC-Challenge Science Reasoning",
  description:
    "Checks whether a model can reason through challenging grade-school science questions and select the correct answer choice.",
  systemPrompt:
    "Answer the multiple-choice science question with concise reasoning, then end with exactly `FINAL ANSWER: <choice letter>`.",
  cases: {
    transformer: "../transformers/index.ts",
    sources: {
      cases: "../data/science-reasoning.jsonl",
    },
  },
  evaluate: { kind: "non_empty" },
}
