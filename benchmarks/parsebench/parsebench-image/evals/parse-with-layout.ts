export default {
  id: "parse-with-layout",
  title: "ParseBench parse with layout (PNG)",
  description:
    "Parses each ParseBench page, rendered to PNG, into layout-annotated markdown and scores it with upstream ParseBench's evaluation.",
  cases: {
    transformer: "../transformers/index.ts",
    sources: { documents: "../data/documents.jsonl" },
  },
  evaluate: { kind: "container", grader: "parsebench" },
}
