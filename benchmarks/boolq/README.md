# BoolQ Trunchbull port

This zero-dependency port contains all 3,270 labeled questions from the BoolQ
validation split. Every case presents its original passage and question, then
requires a `YES` or `NO` answer. The transformer uses a deterministic
`answer_bank` evaluator and requires models to end with
`FINAL ANSWER: YES` or `FINAL ANSWER: NO`.

The original BoolQ repository publishes the development split as `dev.jsonl`,
but its historical Cloud Storage download is no longer anonymously readable.
This port vendors the equivalent validation split from the pinned
[`google/boolq`](https://huggingface.co/datasets/google/boolq) Parquet mirror,
normalizes it to canonical JSONL, and records both upstream revisions and the
vendored source hash in `provenance.json`.

Generate the immutable JSONL export and hash receipt with:

```sh
pnpm benchmarks:transform -- \
  --transformer=examples/benchmarks/boolq/transformers/index.ts \
  --source=validation=examples/benchmarks/boolq/data/validation.jsonl \
  --output=examples/benchmarks/boolq/exports/validation.jsonl
```

BoolQ is released under the Creative Commons Attribution-ShareAlike 3.0
license. Its paper is [BoolQ: Exploring the Surprising Difficulty of Natural
Yes/No Questions](https://arxiv.org/abs/1905.10044).
