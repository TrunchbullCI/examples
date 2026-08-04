export default {
  protocolVersion: 1,
  title: "SkateBench",
  version: "1.0.1",
  description:
    "A Trunchbull port of SkateBench's skateboard terminology and UploadThing awareness suites.",
  license: "MIT",
  homepage: "https://github.com/t3-content/skatebench",
  tags: ["skateboarding", "knowledge", "ported"],
  defaults: {
    limits: {
      maxSteps: 1,
      maxToolCalls: 0,
      maxOutputTokens: 1_000,
    },
  },
  evals: ["evals/skate-tricks.ts", "evals/uploadthing.ts"],
}
