export default {
  id: "parse-with-layout",
  title: "ParseBench parse with layout (PDF)",
  description:
    "Parses each original ParseBench page into layout-annotated markdown and scores it with upstream ParseBench's evaluation.",
  disclosure: "public_sample",
  cases: {
    transformer: "../transformers/index.ts",
    sources: { documents: "../data/documents.jsonl" },
  },
  evaluate: { kind: "container", grader: "parsebench" },
}
