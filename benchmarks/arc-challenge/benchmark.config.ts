export default {
  protocolVersion: 1,
  title: "ARC-Challenge",
  version: "1.0.0",
  description:
    "The complete labeled ARC-Challenge train, validation, and test splits for grade-school science reasoning.",
  license: "CC-BY-SA-4.0",
  homepage: "https://huggingface.co/datasets/allenai/ai2_arc",
  tags: ["science", "reasoning", "multiple-choice", "ported"],
  defaults: {
    limits: {
      maxSteps: 1,
      maxToolCalls: 0,
      maxOutputTokens: 256,
    },
  },
  evals: ["evals/science-reasoning.ts"],
}
