# TypeScript evaluator example

Inspect this benchmark using:

```text
benchmarks/typescript-evaluator/benchmark.config.ts
```

Its eval exports one module-level `evaluate` function. Each inline case supplies
JSON through `data`; the deployed evaluator receives that value as `caseData`
and may return a fractional score.
