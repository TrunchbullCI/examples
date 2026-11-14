Implement semver's range matching: `satisfies`, `maxSatisfying`,
`minSatisfying` and `validRange` for npm-style ranges such as `^1.2.3`,
`~1.2`, `1.x || >=2.5.0` and `1.2.3 - 2.3.4`.

```ts
export interface Options {
  loose?: boolean
  includePrerelease?: boolean
}

export function satisfies(version: string, range: string, optionsOrLoose?: boolean | Options | null): boolean
export function maxSatisfying(versions: readonly string[], range: string, optionsOrLoose?: boolean | Options | null): string | null
export function minSatisfying(versions: readonly string[], range: string, optionsOrLoose?: boolean | Options | null): string | null
export function validRange(range: string | null | undefined, optionsOrLoose?: boolean | Options | null): string | null
```

None of these functions throws.

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

## Ordering

Versions are ordered by major, minor and patch. A version without a
prerelease is greater than the same version with one. Prereleases compare
identifier by identifier: a missing identifier sorts first, numbers compare
numerically, a number sorts before a string, and strings compare with `<`.
Build metadata does not affect the order.

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

- The range is trimmed and every run of whitespace becomes one space . Whitespace between an operator (including `~`, `~>` and
  `^`) and its version is removed. Build metadata is ignored.
- Comparators are formatted as operator plus strict version, with `=` dropped;
  `>=0.0.0` (and `>=0.0.0-0` with `includePrerelease`) is dropped as it
  matches everything, leaving the empty comparator `""` (any version).
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

### Functions

- `satisfies(v, range, options)`: true when `v` satisfies the range; false
  when the range is invalid or `v` is falsy or not a valid version (parsed
  with the same options).
- `validRange(range, options)`: the normalised range string (comparators
  joined by a space, sets by `||`), `"*"` when it is empty, or `null` when
  it is invalid or not a string.
- `maxSatisfying(versions, range, options)` and `minSatisfying`: the
  element of `versions` (returned as given) that satisfies the range and is
  highest or lowest by `compare`; on ties the first one found wins. `null`
  when nothing matches or the range is invalid.

```ts
satisfies("1.2.3", "1.x || >=2.5.0 || 5.0.0 - 7.2.3") // true
satisfies("1.2.4-beta", "^1.2.3") // false
satisfies("1.2.4-beta", "^1.2.3", { includePrerelease: true }) // true
satisfies("1.2.3-pr.2", ">=1.2.3-pr.1 <2") // true
validRange("~1.2.3 || 2") // ">=1.2.3 <1.3.0-0||>=2.0.0 <3.0.0-0"
validRange(">= 1.2 < 2") // ">=1.2.0 <2.0.0-0"
validRange("") // "*"
validRange("blerg") // null
maxSatisfying(["1.2.3", "1.2.4", "1.3.0"], "~1.2.0") // "1.2.4"
minSatisfying(["1.2.3", "1.2.4"], "1.2") // "1.2.3"
```
