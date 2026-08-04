# PIQA Trunchbull port

This zero-dependency port contains all 1,838 labeled PIQA development cases.
Each case presents an everyday goal with two solutions. The transformer keeps
the upstream solution order, validates that every label is aligned with exactly
one input row, and grades the selected `A` or `B` answer with a deterministic
`answer_bank` evaluator.

The port vendors `dev.jsonl` and `dev-labels.lst` from the official
`physicaliqa-train-dev.zip` archive. `provenance.json` records the archive hash
alongside the individual source hashes, so the two files cannot be silently
misaligned or replaced.

Generate the immutable JSONL export and hash receipt with:

```sh
pnpm benchmarks:transform -- \
  --transformer=examples/benchmarks/piqa/transformers/index.ts \
  --source=validation=examples/benchmarks/piqa/data/validation.jsonl \
  --source=labels=examples/benchmarks/piqa/data/validation-labels.lst \
  --output=examples/benchmarks/piqa/exports/validation.jsonl
```

PIQA is distributed under the Academic Free License 3.0. Its paper is
[PIQA: Reasoning about Physical Commonsense in Natural Language](https://arxiv.org/abs/1911.11641).
