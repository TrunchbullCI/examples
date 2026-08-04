export default {
  protocolVersion: 1,
  title: "TruthfulQA MC1",
  version: "1.0.0",
  description:
    "The TruthfulQA MC1 multiple-choice benchmark, with one correct answer and fixed, deterministic choice order.",
  license: "Apache-2.0",
  homepage: "https://github.com/sylinrl/TruthfulQA",
  tags: ["truthfulness", "safety", "multiple-choice", "ported"],
  defaults: {
    limits: {
      maxSteps: 1,
      maxToolCalls: 0,
      maxOutputTokens: 64,
    },
  },
  evals: ["evals/mc1.ts"],
}
