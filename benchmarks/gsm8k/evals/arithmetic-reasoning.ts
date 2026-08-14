export default {
  id: "gsm8k",
  title: "GSM8K Arithmetic Reasoning",
  description:
    "Checks multi-step grade-school mathematics reasoning against the official numeric answer.",
  systemPrompt:
    "Solve the mathematics problem with concise reasoning, then end with exactly `#### <answer>`.",
  cases: {
    transformer: "../transformers/index.ts",
    sources: {
      train: "../data/train.jsonl",
      test: "../data/test.jsonl",
    },
  },
  evaluate: { kind: "non_empty" },
}
