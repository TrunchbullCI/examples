# ARC-Challenge Mini Trunchbull port

This zero-dependency benchmark port contains five fixed questions from the
ARC-Challenge train split. It tests multiple-choice grade-school science
reasoning using the existing declarative `answer_bank` evaluator.

The example keeps the upstream ARC-shaped rows under `data/` and converts them
with `transformers/index.ts`. `evals/science-reasoning.ts` declares the source
and transformer. The normalized fixture under `exports/` can be reproduced
with:

```sh
pnpm benchmarks:transform -- \
  --transformer=examples/benchmarks/arc-challenge/transformers/index.ts \
  --source=cases=examples/benchmarks/arc-challenge/data/science-reasoning.jsonl \
  --output=examples/benchmarks/arc-challenge/exports/science-reasoning.jsonl
```

The prompt contract asks the model to end with `FINAL ANSWER: <choice letter>`.
Each case accepts the correct final-answer marker and rejects the other answer
markers before checking the accepted answer.

## Provenance

- Dataset publisher: Allen Institute for AI
- Dataset: <https://huggingface.co/datasets/allenai/ai2_arc>
- Dataset license: CC BY-SA 4.0
- Paper: <https://arxiv.org/abs/1803.05457>
- Source subset: `ARC-Challenge`
- Source split: `train`

The public marketing sampler and this authoring example intentionally use the
same five source IDs.
