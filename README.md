# Trunchbull Examples

Official, zero-dependency benchmark ports and authoring examples for
[Trunchbull](https://github.com/PabloG6/trunchbull).

Each directory under [`benchmarks/`](./benchmarks) is a self-contained package.
The canonical ports vendor or normalize a pinned upstream corpus, preserve its
intended evaluation boundary, and compile it into deterministic Trunchbull
cases. Benchmark authors may use ordinary JavaScript or TypeScript, built-in
APIs, and relative imports within their package; they do not need a Trunchbull
SDK, CLI, or framework dependency.

## Local development with Trunchbull

Keep this repository checked out at `examples/` inside a Trunchbull checkout:

```sh
git clone git@github.com:TrunchbullCI/examples.git examples
```

The parent Trunchbull repository ignores this nested checkout. Commit and push
benchmark example changes from this repository, not from the parent repository.

## Canonical ports

- [`BoolQ`](./benchmarks/boolq): 3,270 labeled validation questions for
  passage-grounded yes/no reasoning.
- [`GSM8K`](./benchmarks/gsm8k): 8,792 official train and test problems for
  multi-step grade-school mathematics.
- [`HellaSwag`](./benchmarks/hellaswag): 10,042 labeled validation cases for
  commonsense sentence continuation.
- [`Medical AI Failure Atlas`](./benchmarks/medical-ai-failure-atlas): 44
  approved synthetic medical-AI safety cases with a deterministic evaluator.
- [`PIQA`](./benchmarks/piqa): 1,838 labeled development cases for physical
  commonsense reasoning.
- [`TerminalBench 2.0`](./benchmarks/terminal-bench-2): pinned binary verifier
  assets used by the 89-case official release.
- [`TruthfulQA MC1`](./benchmarks/truthfulqa-mc): 790 single-true questions
  with deterministic choice randomization.

Each port README explains the source boundary, transformation, grading contract,
and regeneration command. `provenance.json` records the pinned upstream
revision, license, case counts, and relevant hashes. The Trunchbull port commit
is tracked separately from upstream provenance at publication time.

These packages are ports, not replacements for the upstream projects. Preserve
the attribution and licensing information in each package, and do not assume a
single repository-wide license applies to upstream benchmark content.
