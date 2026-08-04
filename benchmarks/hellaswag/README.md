# HellaSwag Trunchbull port

This zero-dependency port contains every one of the 10,042 labeled HellaSwag
validation cases. Each case presents the upstream context and its four original
continuations. The transformer preserves their order and applies the upstream
numeric label to an exact `A`–`D` `answer_bank` evaluator.

The port intentionally excludes the unlabeled test split. Its upstream commit,
source hash, case count, and MIT attribution are recorded in
`provenance.json`.

Generate the immutable JSONL export and hash receipt with:

```sh
pnpm benchmarks:transform -- \
  --transformer=examples/benchmarks/hellaswag/transformers/index.ts \
  --source=validation=examples/benchmarks/hellaswag/data/validation.jsonl \
  --output=examples/benchmarks/hellaswag/exports/validation.jsonl
```

The source benchmark is [HellaSwag: Can a Machine Really Finish Your
Sentence?](https://arxiv.org/abs/1905.07830).
