`semver` is the semantic version parser used by npm. It parses and
compares versions, increments them, matches them against ranges such as
`^1.2.3` or `>=1.2.0 <2 || 3.x`, and coerces loose text into versions.

Write this subset of the library (leave out `truncate`, `intersects`,
`outside`/`gtr`/`ltr`, `subset`, `simplifyRange`, `toComparators` and
the regular-expression exports).

## API

```ts
export type ReleaseType = "major" | "premajor" | "minor" | "preminor" | "patch" | "prepatch" | "prerelease" | "release"
export type Operator = "===" | "!==" | "" | "=" | "==" | "!=" | ">" | ">=" | "<" | "<="

export interface Options {
  loose?: boolean
  includePrerelease?: boolean
}

export interface CoerceOptions extends Options {
  rtl?: boolean
}

type Version = string | SemVer
type Loose = boolean | Options | null

export class SemVer {
  raw: string
  loose: boolean
  includePrerelease: boolean
  options: Options
  major: number
  minor: number
  patch: number
  version: string
  prerelease: (string | number)[]
  build: string[]
  constructor(version: string | SemVer, optionsOrLoose?: Loose)
  format(): string
  toString(): string
  compare(other: string | SemVer): 1 | 0 | -1
  compareMain(other: string | SemVer): 1 | 0 | -1
  comparePre(other: string | SemVer): 1 | 0 | -1
  compareBuild(other: string | SemVer): 1 | 0 | -1
  inc(release: ReleaseType, identifier?: string, identifierBase?: string | false): SemVer
}

export class Comparator {
  static get ANY(): symbol
  semver: SemVer | symbol
  operator: "" | "<" | ">" | "<=" | ">="
  value: string
  loose: boolean
  options: Options
  constructor(comp: string | Comparator, optionsOrLoose?: Loose)
  toString(): string
  test(version: string | SemVer | symbol): boolean
}

export class Range {
  raw: string
  loose: boolean
  includePrerelease: boolean
  options: Options
  set: Comparator[][]
  constructor(range: string | Range | Comparator, optionsOrLoose?: Loose)
  get range(): string
  format(): string
  toString(): string
  test(version: string | SemVer): boolean
}

export function parse(version: unknown, optionsOrLoose?: Loose, throwErrors?: boolean): SemVer | null
export function valid(version: unknown, optionsOrLoose?: Loose): string | null
export function clean(version: string, optionsOrLoose?: Loose): string | null
export function inc(
  version: Version,
  release: ReleaseType,
  optionsOrLoose?: Loose | string,
  identifier?: string | false,
  identifierBase?: string | false
): string | null
export function diff(version1: Version, version2: Version): ReleaseType | null
export function major(version: Version, optionsOrLoose?: Loose): number
export function minor(version: Version, optionsOrLoose?: Loose): number
export function patch(version: Version, optionsOrLoose?: Loose): number
export function prerelease(version: Version, optionsOrLoose?: Loose): (string | number)[] | null
export function compare(a: Version, b: Version, optionsOrLoose?: Loose): 1 | 0 | -1
export function rcompare(a: Version, b: Version, optionsOrLoose?: Loose): 1 | 0 | -1
export function compareLoose(a: Version, b: Version): 1 | 0 | -1
export function compareBuild(a: Version, b: Version, optionsOrLoose?: Loose): 1 | 0 | -1
export function sort<T extends Version>(list: T[], optionsOrLoose?: Loose): T[]
export function rsort<T extends Version>(list: T[], optionsOrLoose?: Loose): T[]
export function gt(a: Version, b: Version, optionsOrLoose?: Loose): boolean
export function gte(a: Version, b: Version, optionsOrLoose?: Loose): boolean
export function lt(a: Version, b: Version, optionsOrLoose?: Loose): boolean
export function lte(a: Version, b: Version, optionsOrLoose?: Loose): boolean
export function eq(a: Version, b: Version, optionsOrLoose?: Loose): boolean
export function neq(a: Version, b: Version, optionsOrLoose?: Loose): boolean
export function cmp(a: Version, operator: Operator, b: Version, optionsOrLoose?: Loose): boolean
export function coerce(version: unknown, options?: CoerceOptions): SemVer | null
export function satisfies(version: Version, range: string | Range, optionsOrLoose?: Loose): boolean
export function maxSatisfying<T extends Version>(versions: readonly T[], range: string | Range, optionsOrLoose?: Loose): T | null
export function minSatisfying<T extends Version>(versions: readonly T[], range: string | Range, optionsOrLoose?: Loose): T | null
export function minVersion(range: string | Range, optionsOrLoose?: Loose): SemVer | null
export function validRange(range: string | Range | null | undefined, optionsOrLoose?: Loose): string | null
```

Use only named exports; the three classes must be real classes (`instanceof`
checks apply to them).

## Options

Every function and class takes a final options argument. A falsy value means
no options, any other non-object value (for example `true`) means
`{ loose: true }`, and an object is used as given; both flags default to
false.

- `loose`: accept not-quite-valid version strings. Output is always strict.
- `includePrerelease`: treat prerelease versions like normal versions when
  matching ranges.

## Versions

A version follows [SemVer 2.0.0](https://semver.org/):
`MAJOR.MINOR.PATCH`, an optional `-prerelease` and an optional `+build`.

- Numbers have no leading zeros. Prerelease identifiers are dot-separated;
  each is a number without leading zeros or a run of letters, digits and
  `-` containing a non-digit. Build identifiers are runs of letters, digits
  and `-` (leading zeros allowed).
- Surrounding whitespace is ignored and one leading `v` is allowed
  (`" v1.2.3 "` is valid; `"=1.2.3"` is not, except in loose mode).
- Loose mode also accepts any run of `v`, `=` and whitespace before the
  version, leading zeros in numbers and numeric prerelease identifiers, and a
  prerelease without its hyphen: `"=01.02.03beta"` loosely is `1.2.3-beta`.
- Strings longer than 256 characters throw `TypeError`
  `version is longer than 256 characters`. A major, minor or patch above
  `Number.MAX_SAFE_INTEGER` throws `TypeError` `Invalid major version`
  (`minor`, `patch`).
- Numeric prerelease identifiers become numbers when they are below
  `Number.MAX_SAFE_INTEGER`; others stay strings.

### `new SemVer(version, options)`

- Given a `SemVer` whose `loose` and `includePrerelease` match the options,
  returns that same object; given another `SemVer`, parses its `version`.
- A non-string throws `TypeError`
  `Invalid version. Must be a string. Got type "<typeof>".`; an invalid
  string throws `TypeError` `Invalid Version: <input>` (the input as given).
- Fields: `raw` (the input string), `options`, `loose`,
  `includePrerelease`, `major`, `minor`, `patch`, `prerelease` (array),
  `build` (array of strings) and `version` (`major.minor.patch` plus
  `-prerelease`, without build). `format()` recomputes and returns
  `version`; `toString()` returns it.
- `compareMain(other)` compares major, minor and patch.
  `comparePre(other)` compares prereleases: a version without one is greater
  than a version with one; otherwise identifiers are compared in order, a
  missing identifier sorts first, numbers compare numerically, a number sorts
  before a string, and strings compare with `<`. `compare(other)` is
  `compareMain` then `comparePre` (0 at once when `other` is a string
  equal to `version`). `compareBuild(other)` compares build identifiers
  the same way (no build sorts first). A string `other` is parsed with this
  version's options and throws when invalid.

## Parsing helpers

- `parse(v, options, throwErrors = false)`: returns `v` itself when it is a
  `SemVer`, otherwise `new SemVer(v, options)`, or `null` when that
  throws (rethrown when `throwErrors` is true).
- `valid(v, options)`: the parsed `version` string, or `null`.
- `clean(v, options)`: trims `v`, strips leading `=` and `v` characters
  and returns the parsed `version`, or `null`: `clean("  =v1.2.3 ")` is
  `"1.2.3"`, `clean("~1.0.0")` is `null`. `v` must be a string.
- `major(v)`, `minor(v)`, `patch(v)`: the number, via `new SemVer` (so
  invalid input throws).
- `prerelease(v)`: the prerelease array, or `null` when it is empty or
  `v` is invalid. `prerelease("1.2.3-alpha.1")` is `["alpha", 1]`.

## Comparison

Each takes two versions (strings or `SemVer`s) and options, parses both
with `new SemVer` (invalid input throws) and compares them like
`SemVer#compare`; build metadata is ignored unless stated.

- `compare(a, b)` returns `1`, `0` or `-1`; `rcompare` is the reverse;
  `compareLoose(a, b)` is `compare(a, b, true)`.
- `compareBuild(a, b)` is `compare`, then `compareBuild` on a tie.
- `gt`, `gte`, `lt`, `lte`, `eq`, `neq`: the obvious relations over
  `compare`. `eq("1.2.3", "v1.2.3")` is true.
- `cmp(a, op, b)`: `"==="` and `"!=="` compare the strings (a `SemVer`
  contributes its `version`); `""`, `"="` and `"=="` mean `eq`; `"!="`
  `neq`; `">"`, `">="`, `"<"`, `"<="` the relations. Any other operator
  throws `TypeError` `Invalid operator: <op>`.
- `sort(list)` sorts the array in place with `compareBuild` and returns it;
  `rsort` sorts descending.

## Incrementing

`SemVer#inc(release, identifier, identifierBase)` changes the version in
place, recomputes `version`, sets `raw` to `version` plus `+build` when
there is build metadata, and returns the object. Release types:

- `major`: bump major unless the version is a prerelease of an
  `X.0.0` (then `X.0.0-pre` → `X.0.0`); zero minor and patch; drop the
  prerelease. `minor`: bump minor unless it is a prerelease of an
  `X.Y.0`; zero patch; drop the prerelease. `patch`: bump patch unless
  it is a prerelease; drop the prerelease.
- `premajor`, `preminor`, `prepatch`: drop any prerelease, add one to that
  part, zero the lower parts and start a new prerelease.
- `prerelease`: a release version is first bumped as for `patch`; then the
  prerelease is incremented: the last numeric identifier goes up by one, or,
  when there is none, the base number is appended.
- `release`: drop the prerelease; throws `Error`
  `version <raw> is not a prerelease` when there is none.
- `base` is `1` when `Number(identifierBase)` is truthy and `0` otherwise.
  A new prerelease is `[base]`. When an identifier is given, the result is
  then replaced by `[identifier, base]` (just `[identifier]` when
  `identifierBase === false`) unless the prerelease already starts with the
  identifier's dot-separated parts followed by a number.
  `inc("1.2.3", "prerelease", "beta")` is `"1.2.4-beta.0"`;
  `inc("1.2.4-beta.0", "prerelease", "beta")` is `"1.2.4-beta.1"`;
  `inc("1.2.3", "prerelease", "beta", false)` is `"1.2.4-beta"`.
- Errors (`Error`): an unknown release type throws
  `invalid increment argument: <release>`. For the `pre*` types, an empty
  identifier with `identifierBase === false` throws
  `invalid increment argument: identifier is empty`, and an identifier that
  is not a valid prerelease (checked with this version's `loose`) throws
  `invalid identifier: <identifier>`. Appending to a prerelease that has no
  number when `identifierBase === false` and the identifier equals the
  current prerelease throws
  `invalid increment argument: identifier already exists`. A failed
  `inc` leaves the version unchanged.

`inc(version, release, options, identifier, identifierBase)` returns the new
version string, or `null` when the version is invalid or the increment
throws. It never modifies a `SemVer` passed in. When `options` is a string
it is the identifier (and the next argument the base):
`inc("1.2.3", "prerelease", "beta", "1")` is `"1.2.4-beta.1"`.

`diff(a, b)` returns the release type that separates two versions, or
`null` when they are equal (build metadata is ignored). Invalid input
throws `TypeError` `Invalid Version: <input>`.

- When the lower version is a prerelease and the higher is not: if the
  lower one's minor and patch are both 0 the answer is `major`; if both share
  major, minor and patch it is `minor` when the lower one has a non-zero
  minor and zero patch, and `patch` otherwise.
- Otherwise it is the first of `major`, `minor`, `patch` that differs,
  prefixed with `pre` when the higher version is a prerelease, or
  `prerelease` when only the prerelease differs.
- `diff("1.2.3", "2.0.0-pre")` is `"premajor"`, `diff("1.0.0-1", "1.0.0")`
  is `"major"`, `diff("1.1.0-pre-1", "1.1.0-pre-2")` is `"prerelease"`.

## Ranges

A range is one or more comparator sets joined by `||`; a set is
comparators separated by whitespace and matches a version that satisfies all
of them. A comparator is an operator (`<`, `<=`, `>`, `>=`, `=` or
none, meaning equal) and a version. A version satisfies a range when it
satisfies every comparator of at least one set.

### Prerelease tags

A prerelease version (`1.2.3-alpha.3`) only satisfies a set when at least
one comparator in that set has a prerelease on the same `[major, minor,
patch]` tuple. `>1.2.3-alpha.3` matches `1.2.3-alpha.7` but not
`3.4.5-alpha.9`; `3.4.5` matches. With `includePrerelease` this extra
rule is off.

### Advanced syntax

Advanced ranges desugar into primitive comparators. Upper bounds get a
`-0` prerelease so that prereleases of the excluded version stay out.

- Hyphen ranges (spaces around `-` required): `1.2.3 - 2.3.4` :=
  `>=1.2.3 <=2.3.4`; a partial lower bound fills zeros (`1.2 - 2.3.4` :=
  `>=1.2.0 <=2.3.4`); a partial upper bound accepts its whole tuple
  (`1.2.3 - 2.3` := `>=1.2.3 <2.4.0-0`, `1.2.3 - 2` := `>=1.2.3 <3.0.0-0`).
- X-ranges: `x`, `X` or `*` stand for a number, and missing parts are
  X's: `*` and `""` match anything; `1.x` and `1` := `>=1.0.0 <2.0.0-0`;
  `1.2.x` := `>=1.2.0 <1.3.0-0`. With an operator: `>1` := `>=2.0.0`,
  `>1.2` := `>=1.3.0`, `>=1.2` := `>=1.2.0`, `<1.2` := `<1.2.0-0`,
  `<=1.2` := `<1.3.0-0`, `=1.x` is `1.x`. `>*` and `<*` match nothing
  (`<0.0.0-0`). An X followed by a number (`1.x.2`) is not valid.
- Tilde (`~` or `~>`): `~1.2.3` := `>=1.2.3 <1.3.0-0`, `~1.2` :=
  `>=1.2.0 <1.3.0-0`, `~1` := `>=1.0.0 <2.0.0-0`,
  `~1.2.3-beta.2` := `>=1.2.3-beta.2 <1.3.0-0`.
- Caret: keeps the left-most non-zero part. `^1.2.3` := `>=1.2.3 <2.0.0-0`,
  `^0.2.3` := `>=0.2.3 <0.3.0-0`, `^0.0.3` := `>=0.0.3 <0.0.4-0`,
  `^1.2.x` := `>=1.2.0 <2.0.0-0`, `^0.0.x` and `^0.0` :=
  `>=0.0.0 <0.1.0-0`, `^1.x` := `>=1.0.0 <2.0.0-0`, `^0.x` :=
  `>=0.0.0 <1.0.0-0`, `^1.2.3-beta.2` := `>=1.2.3-beta.2 <2.0.0-0`.
- With `includePrerelease`, a lower bound filled in from a partial version
  (an X-range, a partial tilde, caret or hyphen bound) ends in `-0`, as does
  a full hyphen lower bound without a prerelease: `~1.2` :=
  `>=1.2.0-0 <1.3.0-0`, `>1.2` := `>=1.3.0-0`, `1.2.3 - 2` :=
  `>=1.2.3-0 <3.0.0-0`. A full upper hyphen bound `2.3.4` becomes
  `<2.3.5-0`. Full tilde and caret versions are unchanged (`~1.2.3` :=
  `>=1.2.3 <1.3.0-0`).

### Normalisation

- The range is trimmed and every run of whitespace becomes one space (this is
  `Range#raw`). Whitespace between an operator (including `~`, `~>` and
  `^`) and its version is removed. Build metadata is ignored.
- Comparators are formatted as operator plus strict version, with `=` dropped;
  `>=0.0.0` (and `>=0.0.0-0` with `includePrerelease`) is dropped as it
  matches everything, leaving the empty comparator `""` (any version).
  `Range#range` joins comparators with a space and sets with `||`.
- Within a set, a comparator that matches nothing (`<0.0.0-0`) replaces the
  whole set, duplicates are removed (first position kept, last object), and
  `""` is dropped when there are other comparators. Across sets, sets that
  match nothing are dropped unless all do (then the first stays), and a set
  that is just `""` replaces the whole range.
- Strict mode throws `TypeError` `Invalid comparator: <comparator>` for an
  invalid comparator, where `<comparator>` is the comparator text as it
  stands after the whitespace and desugaring steps above (a number above
  `Number.MAX_SAFE_INTEGER` inside a valid comparator throws the `SemVer`
  error instead). Loose mode drops invalid comparators instead, and a range
  whose sets all end up empty throws `TypeError`
  `Invalid SemVer Range: <raw>`.
- Inputs can be very long (hundreds of thousands of characters, mostly
  whitespace, `0`s or `v`s). Parsing must stay linear: avoid regular
  expressions that backtrack across such runs.

### `new Comparator(comp, options)`

Given a `Comparator` with the same `loose`, returns it; given another,
reparses its `value`. The string is trimmed and inner whitespace collapsed;
it must be one comparator (`>=1.2.3`, `< 2.0.0`, `v1.2.3`) or empty.
`operator` is `""`, `<`, `>`, `<=` or `>=` (`=` becomes `""`);
`semver` is the parsed `SemVer` (with only the `loose` option), or
`Comparator.ANY` (a symbol) for the empty comparator; `value` is
`operator + semver.version`, or `""` for `ANY`; `toString()` returns
`value`. `test(v)` is true for `ANY` on either side, false for a string
that is not a valid version (parsed with the comparator's options), and
otherwise `cmp(v, operator, semver)`. Invalid input throws `TypeError`
`Invalid comparator: <normalised input>`.

### `new Range(range, options)`

Given a `Range` whose `loose` and `includePrerelease` match, returns it;
given another `Range`, parses its `raw`. Given a `Comparator`, the range
holds just that comparator (`raw` is its `value`). `set` is the array of
comparator sets; `range` (also `format()` and `toString()`) is the
normalised string (`""` for a range that matches anything). `test(v)`
returns false for a falsy `v` or a string that is not a valid version
(parsed with the range's options), and otherwise applies the matching and
prerelease rules above.

### Range functions

- `satisfies(v, range, options)`: `new Range(range, options).test(v)`;
  false when the range is invalid.
- `validRange(range, options)`: the normalised range, `"*"` when it is
  empty, or `null` when it is invalid (or not a string or `Range`).
- `maxSatisfying(versions, range, options)` and `minSatisfying`: the
  element of `versions` (returned as given) that satisfies the range and is
  highest or lowest by `compare`; on ties the first one found wins. `null`
  when nothing matches or the range is invalid.
- `minVersion(range, options)`: the lowest version that can satisfy the
  range, as a new `SemVer` without options, or `null`. It is `0.0.0` or
  `0.0.0-0` when those match; otherwise, for each set, the highest of its
  lower bounds (`>=X` and `=X` give `X`; `>X` gives `X` with patch + 1,
  or with `.0` appended to its prerelease), the lowest of those across sets,
  provided the range accepts it. An invalid range throws.

## Coercion

`coerce(version, options)` turns loose text into a `SemVer` when possible:
a `SemVer` is returned as is, a number is converted to a string, and any
other non-string returns `null`.

- It finds the first digit and reads up to three dot-separated numbers of at
  most 16 digits each; missing parts are `0`, extra parts and surrounding
  text are ignored (`v3.4 replaces v3.3.1` → `3.4.0`,
  `4.6.3.9.2-alpha2` → `4.6.3`). A run of more than 16 digits cannot be
  part of the match, so `10000000000000000.4.7.4` → `4.7.4`. Text without
  digits returns `null`.
- `rtl: true` returns the right-most coercible tuple that does not share an
  ending index with a longer one: `1.2.3.4` → `2.3.4`, `1.2.3/4` →
  `4.0.0`.
- `includePrerelease: true` keeps a prerelease and build that directly follow
  the matched numbers: `1-rc.5` → `1.0.0-rc.5`, `1.2.3.4-rc.1+rev.2` with
  `rtl` → `2.3.4-rc.1+rev.2`.
- The result is `parse("<major>.<minor>.<patch>[-pre][+build]", options)`,
  so numbers above `Number.MAX_SAFE_INTEGER` give `null`.

## Examples

```ts
valid("1.2.3") // "1.2.3"
valid("a.b.c") // null
clean("  =v1.2.3   ") // "1.2.3"
satisfies("1.2.3", "1.x || >=2.5.0 || 5.0.0 - 7.2.3") // true
gt("1.2.3", "9.8.7") // false
lt("1.2.3", "9.8.7") // true
minVersion(">=1.0.0") // SemVer 1.0.0
coerce("v2") // SemVer 2.0.0
coerce("42.6.7.9.3-alpha") // SemVer 42.6.7
validRange("~1.2.3 || 2") // ">=1.2.3 <1.3.0-0||>=2.0.0 <3.0.0-0"
maxSatisfying(["1.2.3", "1.2.4", "1.3.0"], "~1.2.0") // "1.2.4"
inc("1.2.3", "premajor", "beta") // "2.0.0-beta.0"
diff("1.2.3", "1.3.0") // "minor"
```
