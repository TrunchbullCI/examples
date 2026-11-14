export default {
  protocolVersion: 1,
  title: "Hand-Rolled",
  version: "1.0.0",
  description:
    "Can a model reproduce a convenience library correctly, with no dependencies? Create rebuilds a library's public API from a README-level description; Feature implements one named feature exactly. Each answer is one TypeScript module, graded with the library's own hidden upstream tests and differential fuzzing against the real package. Importing a package, failing a strict typecheck or throwing at load scores 0.",
  license: "MIT AND ISC AND BSD-2-Clause AND BSD-3-Clause",
  homepage: "https://github.com/TrunchbullCI/examples/tree/main/benchmarks/hand-rolled",
  tags: ["coding", "typescript", "libraries", "zero-dependency"],
  metrics: [
    {
      key: "score",
      label: "Hand-Rolled score",
      direction: "higher",
      format: "percent",
      aggregate: "mean",
    },
  ],
  headline: "score",
  groups: [
    {
      key: "create",
      label: "Create",
      description: "Reimplement the library's public API from a README-level description.",
    },
    {
      key: "feature",
      label: "Feature",
      description: "Implement one named feature of the library exactly, edge cases included.",
    },
    { key: "tiny", label: "Tiny libraries" },
    { key: "medium", label: "Medium libraries" },
    { key: "hard", label: "Hard libraries" },
    { key: "is-number", label: "is-number" },
    { key: "clsx", label: "clsx" },
    { key: "ms", label: "ms" },
    { key: "uuid", label: "uuid" },
    { key: "dotenv", label: "dotenv" },
    { key: "deep-equal", label: "deep-equal" },
    { key: "lodash", label: "lodash (debounce, throttle, cloneDeep)" },
    { key: "qs", label: "qs" },
    { key: "semver", label: "semver" },
    { key: "yargs-parser", label: "yargs-parser" },
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
  evals: ["evals/create.ts", "evals/feature.ts"],
  graders: {
    "hand-rolled": { context: "grader", instanceType: "standard-2" },
  },
}
