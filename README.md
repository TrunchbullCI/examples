# Trunchbull Examples

Official, zero-dependency benchmark authoring examples for
[Trunchbull](https://github.com/PabloG6/trunchbull).

Each directory under [`benchmarks/`](./benchmarks) is a self-contained benchmark
package. Benchmark authors may use ordinary JavaScript or TypeScript, built-in
APIs, and relative imports within their package; they do not need a Trunchbull
SDK, CLI, or framework dependency.

## Local development with Trunchbull

Keep this repository checked out at `examples/` inside a Trunchbull checkout:

```sh
git clone git@github.com:TrunchbullCI/examples.git examples
```

The parent Trunchbull repository ignores this nested checkout. Commit and push
benchmark example changes from this repository, not from the parent repository.

## Included benchmarks

- [`arc-challenge`](./benchmarks/arc-challenge)
- [`gsm8k`](./benchmarks/gsm8k)
- [`skatebench`](./benchmarks/skatebench)
- [`typescript-evaluator`](./benchmarks/typescript-evaluator)

Each port retains its own upstream provenance and licensing information. Do not
assume a single repository-wide license applies to upstream benchmark content.

## Included simulations

Simulation repositories use the typed Trunchbull simulation SDK because they
define long-running environments, model roles, ordered stages, and a simulator
driver. Unlike benchmark authoring packages, they declare the SDK as an
ordinary pinned package dependency.

- [`pkmnshowdown`](./sims/pkmnshowdown)
