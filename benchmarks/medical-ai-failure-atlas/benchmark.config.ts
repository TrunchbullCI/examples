export default {
  protocolVersion: 1,
  title: "Medical AI Failure Atlas",
  version: "0.2.1",
  description:
    "A clinician-built, synthetic safety benchmark for evaluating escalation, uncertainty, and safety boundaries in medical AI responses.",
  license: "CC-BY-4.0",
  homepage: "https://github.com/goktugozkanmd/medical-ai-failure-atlas",
  tags: [
    "medical-ai",
    "safety",
    "synthetic-data",
    "custom-evaluator",
    "ported",
  ],
  defaults: {
    limits: {
      maxSteps: 1,
      maxToolCalls: 0,
      maxOutputTokens: 512,
    },
  },
  evals: ["evals/medical-ai-safety.ts"],
};
