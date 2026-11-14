Implement semver's version parsing and comparison: the `SemVer` class
(without `inc`), `parse`, `valid`, `clean`, `major`, `minor`, `patch`,
`prerelease` and the comparison and sorting functions.

```ts
export interface Options {
  loose?: boolean
  includePrerelease?: boolean
}
export type Operator = "===" | "!==" | "" | "=" | "==" | "!=" | ">" | ">=" | "<" | "<="
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
}

export function parse(version: unknown, optionsOrLoose?: Loose, throwErrors?: boolean): SemVer | null
export function valid(version: unknown, optionsOrLoose?: Loose): string | null
export function clean(version: string, optionsOrLoose?: Loose): string | null
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
```

`SemVer` must be a real class (`instanceof` checks apply to it).

## Options

Every function and class takes a final options argument. A falsy value means
no options, any other non-object value (for example `true`) means
`{ loose: true }`, and an object is used as given; both flags default to
false.

- `loose`: accept not-quite-valid version strings. Output is always strict.
- `includePrerelease`: stored on the version; it only matters for range
  matching.

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

```ts
valid("1.2.3") // "1.2.3"
valid("a.b.c") // null
valid("4.2.0foo", true) // "4.2.0-foo"
clean("  =v1.2.3   ") // "1.2.3"
new SemVer("1.2.3-beta.10+exp.sha").prerelease // ["beta", 10]
compare("1.2.3-beta.2", "1.2.3-beta.10") // -1
compare("1.2.3-alpha", "1.2.3") // -1
compareBuild("1.0.0+1", "1.0.0+1.0") // -1
gt("1.2.3", "9.8.7") // false
cmp("1.2.3", "===", "v1.2.3") // false
sort(["1.2.3+1", "1.2.3", "0.1.2"]) // ["0.1.2", "1.2.3", "1.2.3+1"]
```
