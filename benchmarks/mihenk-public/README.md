# MIHENK Public Sample

This package ports the complete public development split of
[MIHENK](https://huggingface.co/datasets/gorkemergune/mihenk-benchmark) into
Trunchbull's zero-dependency benchmark authoring format.

## Scope

- One benchmark family with 80 selectable evaluation cases.
- 40 Turkish and 40 English cases.
- 40 multiple-choice and 40 short-answer cases.
- 20 cases at each difficulty level from L1 through L4.
- No private-holdout records are included.

The source dataset is pinned to Hugging Face revision
`8341ae010c60fdb30607b1718c072bf9d05ddc0a`. The reference scoring semantics
were checked against the upstream GitHub scorer at revision
`c449de0c84191cd830453c32a3a8044a22557c97`.

## Evaluation

Multiple-choice responses use the upstream answer-letter extraction rules.
Short answers preserve the upstream seven-word limit, Turkish-aware Unicode
normalization, canonical and alias matching, and numeric tolerance.

## Attribution

The upstream public data is CC BY 4.0. See `LICENSE.upstream` and
`provenance.json` for attribution, the pinned revision, and the source hash.
This is a TrunchbullCI port, not an upstream-maintained MIHENK distribution.
