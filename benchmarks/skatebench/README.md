# SkateBench Trunchbull port

This is a publishable benchmark repository using Trunchbull's zero-SDK
authoring contract. It ports all eight cases from the upstream SkateBench
`skate-trick-test.json` and `uploadthing-test.json` suites.

The port preserves SkateBench's grading order:

1. Any case-insensitive forbidden-answer substring fails the case.
2. Otherwise, any case-insensitive accepted-answer substring passes the case.

The optional `forbiddenAnswers` field extends the existing declarative
`answer_bank` evaluator; no custom evaluator function runs at publication or
trial time.

## Provenance

- Upstream: <https://github.com/t3-content/skatebench>
- Pinned source commit: `a4d54c25390fb5d62775e18f75a898332447ae0b`
- License: MIT; see `LICENSE.upstream`
- Checksums: see `provenance.json`
- Ported suites:
  - `bench/tests/skate-trick-test.json`
  - `bench/tests/uploadthing-test.json`

The upstream runner also records token usage, cost, latency, and repeated model
runs. Trunchbull supplies those execution concerns at run launch rather than in
the benchmark source.
