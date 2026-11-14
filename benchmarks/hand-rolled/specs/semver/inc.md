Implement semver's increment operations: `SemVer#inc`, the `inc` and
`diff` functions, and the parsing they rely on (`SemVer` and `parse`).

```ts
export type ReleaseType = "major" | "premajor" | "minor" | "preminor" | "patch" | "prepatch" | "prerelease" | "release"

export interface Options {
  loose?: boolean
  includePrerelease?: boolean
}
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
  inc(release: ReleaseType, identifier?: string, identifierBase?: string | false): SemVer
}

export function parse(version: unknown, optionsOrLoose?: Loose, throwErrors?: boolean): SemVer | null
export function inc(
  version: string | SemVer,
  release: ReleaseType,
  optionsOrLoose?: Loose | string,
  identifier?: string | false,
  identifierBase?: string | false
): string | null
export function diff(version1: string | SemVer, version2: string | SemVer): ReleaseType | null
```

`SemVer` must be a real class (`instanceof` checks apply to it). You may add
comparison methods to it.

## Options

Every function and class takes a final options argument. A falsy value means
no options, any other non-object value (for example `true`) means
`{ loose: true }`, and an object is used as given; both flags default to
false.

- `loose`: accept not-quite-valid version strings. Output is always strict.
- `includePrerelease`: stored on the version; it does not affect increments.

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

- `parse(v, options, throwErrors = false)`: returns `v` itself when it is a
  `SemVer`, otherwise `new SemVer(v, options)`, or `null` when that
  throws (rethrown when `throwErrors` is true).

## Ordering

Versions are ordered by major, minor and patch. A version without a
prerelease is greater than the same version with one. Prereleases compare
identifier by identifier: a missing identifier sorts first, numbers compare
numerically, a number sorts before a string, and strings compare with `<`.
Build metadata does not affect the order.

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

```ts
inc("1.2.3", "minor") // "1.3.0"
inc("1.2.3-tag", "major") // "2.0.0"
inc("1.2.0-1", "minor") // "1.2.0"
inc("1.2.3", "premajor", "beta") // "2.0.0-beta.0"
inc("1.2.3-alpha.9.beta", "prerelease") // "1.2.3-alpha.10.beta"
inc("1.2.4-beta.1", "release") // "1.2.4"
inc("1.2.3", "fake") // null
new SemVer("1.2.3+build").inc("patch").raw // "1.2.4+build"
diff("1.2.3", "1.2.4-pre") // "prepatch"
diff("0.0.2-1", "0.1.0") // "minor"
```
