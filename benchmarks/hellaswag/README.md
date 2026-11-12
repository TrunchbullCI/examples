# HellaSwag Trunchbull port

This zero-dependency port contains every one of the 10,042 labeled HellaSwag
validation cases. Each case presents the upstream context and its four original
continuations. The transformer preserves their order and applies the upstream
numeric label to an exact `A`–`D` `answer_bank` evaluator.

The port intentionally excludes the unlabeled test split. Its upstream commit,
source hash, case count, and MIT attribution are recorded in
`provenance.json`.

The upstream `hellaswag_val.jsonl` is split, in order, into
`data/validation-1.jsonl` (rows 1–4,500), `data/validation-2.jsonl`
(rows 4,501–7,300) and `data/validation-3.jsonl` (rows 7,301–10,042), so each
file stays under the 5 MB limit for dataset files committed to a Trunchbull
Repository. Their concatenation is byte-identical to the upstream file.
Regenerate them from a local copy of the upstream file with:

```sh
node tools/split-validation.mjs path/to/hellaswag_val.jsonl
```

The JSONL export is not committed. Generate it and compare it with the
committed hash receipt (`exports/validation.jsonl.manifest.json`) with:

```sh
pnpm benchmarks:transform -- \
  --transformer=examples/benchmarks/hellaswag/transformers/index.ts \
  --source=validation_1=examples/benchmarks/hellaswag/data/validation-1.jsonl \
  --source=validation_2=examples/benchmarks/hellaswag/data/validation-2.jsonl \
  --source=validation_3=examples/benchmarks/hellaswag/data/validation-3.jsonl \
  --output=examples/benchmarks/hellaswag/exports/validation.jsonl
```

The source benchmark is [HellaSwag: Can a Machine Really Finish Your
Sentence?](https://arxiv.org/abs/1905.07830).
