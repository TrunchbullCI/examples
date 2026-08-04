export default {
  protocolVersion: 1,
  title: "BoolQ",
  version: "1.0.0",
  description:
    "The complete labeled BoolQ validation split for passage-grounded yes-or-no question answering.",
  license: "CC-BY-SA-3.0",
  homepage: "https://github.com/google-research-datasets/boolean-questions",
  tags: ["reading-comprehension", "binary", "reasoning", "ported"],
  defaults: {
    limits: {
      maxSteps: 1,
      maxToolCalls: 0,
      maxOutputTokens: 64,
    },
  },
  evals: ["evals/validation.ts"],
}
