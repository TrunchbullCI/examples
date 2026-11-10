export default {
  id: "mihenk-public",
  title: "MIHENK Public Sample",
  description:
    "Evaluates bilingual reasoning with the complete public MIHENK development split and its reference scoring rules.",
  disclosure: "public_sample",
  cases: {
    transformer: "../transformers/index.ts",
    sources: {
      public: "../data/mihenk_public.jsonl",
    },
  },
  evaluate: {
    kind: "custom",
    evaluatorKey: "evaluators/mihenk.ts#default",
    sourcePath: "evaluators/mihenk.ts",
  },
}
