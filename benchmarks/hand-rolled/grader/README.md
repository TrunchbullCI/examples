# Hand-Rolled grader

Grader container for the Hand-Rolled benchmark (Trunchbull grader protocol v1,
port 8080). It grades one TypeScript module per request:

1. **Hard gates** (any failure scores 0; every gate's error count is reported):
   - `imports`: only Node.js built-in modules, with literal specifiers
     (`harness/imports.mjs`).
   - `typecheck`: the module plus a hidden `conformance.ts` that uses the
     documented API must compile under `strict` (TypeScript 6.0.3, ES2023,
     NodeNext, `@types/node` 24) (`harness/typecheck.mjs`).
   - `load`: importing the transpiled module must not throw
     (`harness/load-child.mjs`).
2. **Upstream tests**: the library's own test files, vendored byte for byte
   from the pinned upstream commit, run in child processes against the
   module. Each file's TAP output is parsed into leaf test points
   (`harness/tap.mjs`). The tests fraction is the share of the expected
   points (`expected.json`, recorded from the real library) that pass.
3. **Differential fuzzing**: seeded inputs from `fuzz.mjs` run against the
   module and the real library in separate processes; outputs are compared
   after canonical serialization, and thrown errors by constructor name and
   message (`harness/canonical.mjs`). The fuzz fraction is the share that
   agree.

The score is `tests fraction × fuzz fraction`, unrounded.

## Library layout

```text
libraries/<id>/
├── library.json          metadata, vendored files, suites, aliases, targets
├── package.json          the real package, its types and test frameworks (exact versions)
├── package-lock.json
├── expected.json         generated: test points the reference passes, per target
├── reference.ts          the real package behind the documented API (parity)
├── stub.ts               the documented API with every body throwing (parity)
├── conformance/*.ts      hidden typed usage of the documented API, per target
├── fuzz.mjs              fuzz targets: { targets: { name: { count, input(random), run(api, input) } }, setup? }
├── shims/                modules the upstream tests import instead of the library
├── suite/                upstream test files at their upstream paths
└── upstream/             upstream LICENSE
```

`library.json` targets: `create` and `features.<id>`, each
`{ title?, conformance, tests: [{ suite, match?, exclude? }], fuzz: [targets] }`.
Selectors match test point names, `<suite>:<file> › <path> › <name>`.
`aliases` maps a suite-relative import path (without extension or
`/index`) or `bare:<specifier>` to a shim, resolved by `harness/hooks.mjs`.
Upstream tests that cannot apply to a reimplementation (they stub the
library's internals or test private modules) are left out of the selectors
and listed in `excluded` with the reason.

## Tools

```sh
npm ci && (cd libraries/<id> && npm ci)       # dependencies
node tools/vendor.mjs <id> --from <checkout>  # vendor upstream files at the pinned commit
node tools/vendor.mjs --check                 # verify vendored hashes
node tools/expectations.mjs [<id>]            # record expected.json from the real library
node tools/expectations.mjs --check           # verify expected.json (also run in the image build)
node tools/parity.mjs [<id>]                  # reference 1, stub/empty/forbidden/crash 0, for every target
```
