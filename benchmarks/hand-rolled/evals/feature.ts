export default {
  id: "feature",
  title: "Feature",
  description:
    "Implement one named feature of a convenience library exactly, edge cases included, as one dependency-free TypeScript module.",
  systemPrompt:
    "You are an expert TypeScript engineer. You write explicit, dependency-free code that reproduces a library's observable behaviour exactly, edge cases and errors included. Answer with one complete TypeScript module in a single ```ts code block.",
  disclosure: "public_sample",
  cases: "./feature.jsonl",
  evaluate: { kind: "container", grader: "hand-rolled" },
}
