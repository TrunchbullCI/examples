export default {
  id: "create",
  title: "Create",
  description:
    "Reimplement a convenience library's public API as one dependency-free TypeScript module from a README-level description.",
  systemPrompt:
    "You are an expert TypeScript engineer. You write explicit, dependency-free code that reproduces a library's observable behaviour exactly, edge cases and errors included. Answer with one complete TypeScript module in a single ```ts code block.",
  disclosure: "public_sample",
  cases: "./create.jsonl",
  evaluate: { kind: "container", grader: "hand-rolled" },
}
