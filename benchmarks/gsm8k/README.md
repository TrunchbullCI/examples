# GSM8K Trunchbull port

This zero-dependency port contains all 8,792 cases from the official GSM8K
train and test splits. The upstream source is pinned in `provenance.json`.
Publication records the exact `TrunchbullCI/examples` commit separately as the
immutable port revision.

The transformer namespaces cases by split and extracts the official answer
using the upstream `#### (-?[0-9.,]+)` rule. Runtime evaluation preserves the
upstream behavior: it removes commas and compares the extracted strings.

Generate the immutable JSONL export and hash receipt with:

```sh
pnpm benchmarks:transform -- \
  --transformer=examples/benchmarks/gsm8k/transformers/index.ts \
  --source=train=examples/benchmarks/gsm8k/data/train.jsonl \
  --source=test=examples/benchmarks/gsm8k/data/test.jsonl \
  --output=examples/benchmarks/gsm8k/exports/arithmetic-reasoning.jsonl
```

The source is OpenAI's `grade-school-math` repository at commit
`3101c7d5072418e28b9008a6636bde82a006892c`, licensed MIT.
