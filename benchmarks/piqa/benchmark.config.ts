export default {
  protocolVersion: 1,
  title: "PIQA",
  version: "1.0.0",
  description:
    "The complete labeled PIQA development split for two-choice physical commonsense reasoning.",
  license: "AFL-3.0",
  homepage: "https://yonatanbisk.com/piqa/",
  tags: ["physical-reasoning", "commonsense", "multiple-choice", "ported"],
  defaults: {
    limits: {
      maxSteps: 1,
      maxToolCalls: 0,
      maxOutputTokens: 64,
    },
  },
  evals: ["evals/validation.ts"],
}
