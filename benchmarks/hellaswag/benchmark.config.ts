export default {
  protocolVersion: 1,
  title: "HellaSwag",
  version: "1.0.0",
  description:
    "The complete labeled HellaSwag validation split for adversarially filtered commonsense continuation.",
  license: "MIT",
  homepage: "https://github.com/rowanz/hellaswag",
  tags: ["commonsense", "multiple-choice", "reasoning", "ported"],
  defaults: {
    limits: {
      maxSteps: 1,
      maxToolCalls: 0,
      maxOutputTokens: 64,
    },
  },
  evals: ["evals/validation.ts"],
}
