export default {
  protocolVersion: 1,
  title: "ARC-Challenge Mini",
  version: "1.0.0",
  description:
    "A five-case Trunchbull sampler of challenging grade-school science questions from the AI2 Reasoning Challenge.",
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
