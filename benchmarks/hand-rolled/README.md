# Hand-Rolled

Many popular npm libraries exist mainly to save developers some typing or
thinking. Agents don't mind typing. Hand-Rolled asks whether a model can
reproduce such a library correctly, as one dependency-free TypeScript module,
judged by the library's own test suite and by differential fuzzing against
the real package.

This is an original Trunchbull benchmark. It is not affiliated with or
endorsed by the maintainers of the libraries it uses, and it does not replace
or claim to maintain any of them. Their test suites are vendored unmodified,
under their own licenses (see [NOTICE](./NOTICE)).

## Settings

Both settings use the same 10 libraries and the same grader. Each case is one
model turn with no tools: the model answers with a single `index.ts` in a
```ts block.

- **Create** (10 cases): a README-level description, the exact exports and
  types, and a few examples. The model writes the library's public API (a
  named subset for the larger libraries).
- **Feature** (26 cases): the model implements one named feature exactly,
  edge cases included, such as lodash `debounce` with leading, trailing and
  maxWait, qs nested bracket parsing, or semver range matching.

Cases carry the groups `create` or `feature`, the library's tier and the
library id, so a run can be broken down by any of them.

## Libraries

| Library | Package | Tier | Upstream (pinned) | License | Create tests | Features | Standard alternative |
| --- | --- | --- | --- | --- | ---: | --- | --- |
| is-number | is-number@7.0.0 | tiny | [jonschlinkert/is-number@98e8ff1](https://github.com/jonschlinkert/is-number/tree/98e8ff1da1a89f93d1397a24d7413ed15421c139) | MIT | 111 | numeric strings; numbers and other values | `typeof` plus `Number.isFinite` |
| clsx | clsx@2.1.1 | tiny | [lukeed/clsx@925494c](https://github.com/lukeed/clsx/tree/925494cf31bcd97d3337aacd34e659e80cae7fe2) | MIT | 27 | arrays; class dictionaries | `filter(Boolean).join(" ")` |
| ms | ms@2.1.3 | tiny | [vercel/ms@1c6264b](https://github.com/vercel/ms/tree/1c6264b795492e8fdecbc82cb8802fcfbfc08d26) | MIT | 49 | parse; format | arithmetic over a unit table |
| uuid | uuid@14.0.3 | medium | [uuidjs/uuid@993ff7b](https://github.com/uuidjs/uuid/tree/993ff7b64a289ef7f921ccafc8bb98ef9461d214) | MIT | 69 | v3/v5; v1/v6; parse, stringify, validate | `crypto.randomUUID()` |
| dotenv | dotenv@18.0.10 | medium | [motdotla/dotenv@7ed8f36](https://github.com/motdotla/dotenv/tree/7ed8f363671d3d2027b52cdce4b72b0004d0411a) | BSD-2-Clause | 1,150 | parse; config | `util.parseEnv`, `process.loadEnvFile` |
| deep-equal | deep-equal@2.2.3 | medium | [inspect-js/node-deep-equal@48d3bb5](https://github.com/inspect-js/node-deep-equal/tree/48d3bb5b7fe3e65fd564b737c69a9411eb40bc65) | MIT | 612 | strict and loose; Map and Set; binary | `util.isDeepStrictEqual` |
| lodash (debounce, throttle, cloneDeep) | lodash@4.18.1 | hard | [lodash/lodash@cb0b9b9](https://github.com/lodash/lodash/tree/cb0b9b9212521c08e3eafe7c8cb0af1b42b6649e) | MIT | 94 | debounce; throttle; cloneDeep | `structuredClone`, timers |
| qs | qs@6.17.1 | hard | [ljharb/qs@43baea4](https://github.com/ljharb/qs/tree/43baea4655cb9b543fb1c5cc0db95cde42852140) | BSD-3-Clause | 1,470 | nested parsing; array formats; limits | `URLSearchParams` |
| semver | semver@7.8.6 | hard | [npm/node-semver@b37b033](https://github.com/npm/node-semver/tree/b37b033b585ad5e575afeccadb426ea41bc6cea4) | ISC | 18,544 | range matching; compare; inc | explicit code |
| yargs-parser | yargs-parser@22.0.0 | hard | [yargs/yargs-parser@66f0bb2](https://github.com/yargs/yargs-parser/tree/66f0bb2d2c8a2c9689489784cfe2e5128b0abfc2) | ISC | 314 | dot notation; booleans; arrays and narg | `util.parseArgs` |

Each library's `grader/libraries/<id>/library.json` records the upstream
commit and tag, the SHA-256 of every vendored file, the Create scope, the
tests each target selects, and every excluded upstream test with its reason
(tests of private modules, tests that spawn a CLI, or functions outside a
Create subset). `provenance.json` hashes each `library.json`, the case files
and every `expected.json`.

## Grading

A grader container (`grader/`, protocol v1) grades each answer:

1. **Hard gates.** Any failure scores 0, and each gate's error count is in the
   result details:
   - imports: only Node.js built-in modules, with literal specifiers;
   - typecheck: the module plus a hidden file that uses the documented API
     must compile under `strict` (TypeScript 6.0.3, ES2023, NodeNext,
     `@types/node` 24);
   - load: importing the module must not throw.
2. **Upstream tests.** The library's own test files run unmodified against
   the module, with only the import of the library redirected. The tests
   fraction is the share of the test points the real library passes that the
   module also passes (Feature cases select that feature's tests).
3. **Differential fuzzing.** Seeded inputs run against the module and the
   real package in separate processes. Outputs must match exactly, and thrown
   errors must match by constructor and message (semver compares only the
   error kind for range errors).

The score is `tests fraction × fuzz fraction`, stored unrounded. A module
that throws for everything can pass upstream tests that only assert a throw,
but it agrees with the real library on no fuzz input, so it scores 0.

The hidden tests, fuzz harness and real packages live only in the grader
image, which has no network access. The model gets nothing but the prompt.

### Why a grader container and not a Harbor verifier

A Harbor verifier runs in the trial's sandbox after the agent, and its reward
is reduced to pass or fail for the trial score. A grader container receives
only the final answer, keeps the hidden tests and the real libraries out of
any place the model can reach, and returns a fractional score with details.
Each case is a single answer rather than an agent session, so no per-trial
sandbox is needed.

### Why one Repository

Create and Feature share the libraries, the grader and the answer format, and
their scores mean the same thing. They are two evals (`evals/create.ts` and
`evals/feature.ts`) of one benchmark, distinguished by group, so one run can
cover both and a leaderboard can still separate them.

### Adding the Replace setting

Replace (remove a library from a small app and inline explicit code) adds
`evals/replace.ts`, `replace` cases with `caseData.setting = "replace"`, and
per-library app fixtures under `grader/libraries/<id>/`. The grader already
routes by `caseData.setting`; Replace needs its own target type and an
answer format with more than one file.

## Layout

```text
hand-rolled/
├── benchmark.config.ts    benchmark, groups, limits, grader declaration
├── evals/                 create.ts, feature.ts and their generated .jsonl cases
├── specs/<library>/       prompt sources: create.md and one file per feature
├── tools/build-cases.mjs  builds evals/*.jsonl and provenance.json from specs
├── provenance.json        hashes of library metadata, cases and expectations
├── NOTICE                 upstream attribution
└── grader/                grader context (see grader/README.md)
```

## Checks

```sh
node tools/build-cases.mjs --check
cd grader
npm ci && for d in libraries/*/; do (cd "$d" && npm ci --ignore-scripts); done
node tools/vendor.mjs --check
node tools/expectations.mjs --check
node tools/parity.mjs        # reference 1; stub, empty, forbidden import, crash 0
```

The image build reruns the vendor and expectation checks, so an image whose
Node.js or packages change any upstream result fails to build.
