export default {
  protocolVersion: 1,
  title: "ParseBench (PNG)",
  version: "2.0.0",
  description:
    "Unofficial Trunchbull port of ParseBench. Each case attaches the page rendered to PNG at 150 DPI (long edge capped at 2,000 px) and asks the model to parse it into layout-annotated markdown. Scores come from upstream ParseBench's own evaluation code.",
  license: "Apache-2.0",
  homepage: "https://github.com/run-llama/ParseBench",
  provenance: {
    upstream: {
      url: "https://github.com/run-llama/ParseBench",
      revision: "c38085d2ccd7f717900037e361806d22c51bc33b",
      license: "Apache-2.0",
      paperUrl: "https://arxiv.org/abs/2604.08538",
    },
    sourceFormat:
      "Hugging Face dataset llamaindex/ParseBench at revision 2805a1d940f95a203e0ae4b88be9934f7765b3fc",
  },
  tags: ["document-parsing", "image", "layout", "ported"],
  metrics: [
    {
      key: "score",
      label: "ParseBench score",
      direction: "higher",
      format: "percent",
      aggregate: "mean",
    },
  ],
  headline: "score",
  groups: [
    { key: "table", label: "Tables", description: "GTRM (GriTS + TableRecordMatch)." },
    { key: "chart", label: "Charts", description: "Chart data-point rule pass rate." },
    {
      key: "text-content",
      label: "Content Faithfulness",
      description: "Omissions, hallucinations, and reading order.",
    },
    {
      key: "text-formatting",
      label: "Semantic Formatting",
      description: "Meaningful inline formatting and title hierarchy.",
    },
    {
      key: "layout",
      label: "Visual Grounding",
      description: "Layout element rule pass rate.",
    },
  ],
  settings: [
    { key: "default", label: "Default", trialTimeoutSeconds: 900, default: true },
  ],
  defaults: {
    limits: {
      maxSteps: 1,
      maxToolCalls: 0,
      maxOutputTokens: 16384,
    },
  },
  evals: ["evals/parse-with-layout.ts"],
  graders: {
    parsebench: { context: "grader", instanceType: "standard-2" },
  },
}
