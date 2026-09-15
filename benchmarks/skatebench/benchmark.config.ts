export default {
  protocolVersion: 1,
  title: "SkateBench",
  version: "1.0.2",
  description:
    "A Trunchbull port of SkateBench's skateboard terminology and UploadThing awareness suites.",
  license: "MIT",
  homepage: "https://github.com/t3-content/skatebench",
  provenance: {
    upstream: {
      url: "https://github.com/t3-content/skatebench",
      revision: "a4d54c25390fb5d62775e18f75a898332447ae0b",
      license: "MIT",
      paperUrl: null,
    },
    sourceFormat: null,
    artifacts: [
      {
        kind: "source",
        path: "bench/tests/skate-trick-test.json",
        sha256:
          "8c9762d0e6cd1c4ac7636d7c83230aba8c0a46dc3e9d6a3bb6052bc627a5dd66",
        caseCount: 7,
      },
      {
        kind: "source",
        path: "bench/tests/uploadthing-test.json",
        sha256:
          "c1395c1443f21cf01a6c59d328bdc725be1349114d72e7a4970019d2117e56c4",
        caseCount: 1,
      },
      {
        kind: "generated",
        path: "benchmarks/skatebench/evals/skate-tricks.jsonl",
        sha256:
          "69fe635bfac5d7eccf851b44fbcfecd82da8b8d674358c0df460902f6373acb3",
        caseCount: null,
      },
      {
        kind: "generated",
        path: "benchmarks/skatebench/evals/uploadthing.jsonl",
        sha256:
          "dc1a9f888d9f3b28a5e27d990ffa4ab5f11900eb10642cb875cbe3b5a6247b3b",
        caseCount: null,
      },
    ],
  },
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
