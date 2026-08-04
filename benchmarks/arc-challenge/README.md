# ARC-Challenge Trunchbull port

This zero-dependency port contains all 2,590 labeled ARC-Challenge cases from
the train, validation, and test splits. The source snapshot is pinned in
`provenance.json`. Publication records the exact `TrunchbullCI/examples`
commit separately as the immutable port revision.

The transformer namespaces every case ID by split and converts the upstream
multiple-choice rows into Trunchbull `answer_bank` evaluators. Models must end
with `FINAL ANSWER: <choice label>`.

Generate the immutable JSONL export and hash receipt with:

```sh
pnpm benchmarks:transform -- \
  --transformer=examples/benchmarks/arc-challenge/transformers/index.ts \
  --source=train=examples/benchmarks/arc-challenge/data/train.jsonl \
  --source=validation=examples/benchmarks/arc-challenge/data/validation.jsonl \
  --source=test=examples/benchmarks/arc-challenge/data/test.jsonl \
  --output=examples/benchmarks/arc-challenge/exports/science-reasoning.jsonl
```

The source is AllenAI's `ai2_arc` dataset at revision
`b4aa6eae7e30ce80562db961fd6947ff2d17d590`, licensed CC BY-SA 4.0.
