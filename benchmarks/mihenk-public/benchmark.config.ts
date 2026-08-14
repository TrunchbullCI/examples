export default {
  protocolVersion: 1,
  title: "MIHENK Public Sample",
  version: "1.0.0",
  description:
    "The complete 80-case public development split of the bilingual Turkish-English MIHENK reasoning benchmark.",
  license: "CC-BY-4.0",
  homepage: "https://huggingface.co/datasets/gorkemergune/mihenk-benchmark",
  tags: ["reasoning", "multilingual", "turkish", "bilingual", "ported"],
  defaults: {
    limits: {
      maxSteps: 1,
      maxToolCalls: 0,
      maxOutputTokens: 64,
    },
  },
  evals: ["evals/reasoning.ts"],
}
