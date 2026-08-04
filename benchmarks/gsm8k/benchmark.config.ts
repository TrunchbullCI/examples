export default {
  protocolVersion: 1,
  title: "GSM8K",
  version: "1.0.2",
  description:
    "The complete official GSM8K train and test splits for multi-step grade-school mathematics reasoning.",
  license: "MIT",
  homepage: "https://github.com/openai/grade-school-math",
  tags: ["math", "reasoning", "ported"],
  defaults: {
    limits: {
      maxSteps: 1,
      maxToolCalls: 0,
      maxOutputTokens: 512,
    },
  },
  evals: ["evals/arithmetic-reasoning.ts"],
}
