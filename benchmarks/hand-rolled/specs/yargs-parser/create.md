yargs-parser is the option parser used by yargs: it turns command-line
arguments into an object of options and positionals. Write it as one
TypeScript module whose default export is the parser, with the documented
options and configuration flags below and no dependencies other than Node.js
built-in modules. Behaviour must match yargs-parser 22 exactly.

This task covers a subset of yargs-parser's options: configuration files
(`opts.config`), `opts.configObjects`, environment variables
(`opts.envPrefix`), the `combine-arrays` flag (which only affects those
sources), `opts.key` and the `opts.__` translation hook are left out.

## API

```ts
export interface Arguments {
  _: (string | number)[]
  "--"?: (string | number)[]
  [argName: string]: any
}

export interface Configuration {
  "boolean-negation": boolean
  "camel-case-expansion": boolean
  "dot-notation": boolean
  "duplicate-arguments-array": boolean
  "flatten-duplicate-arrays": boolean
  "greedy-arrays": boolean
  "halt-at-non-option": boolean
  "nargs-eats-options": boolean
  "negation-prefix": string
  "parse-numbers": boolean
  "parse-positional-numbers": boolean
  "populate--": boolean
  "set-placeholder-key": boolean
  "short-option-groups": boolean
  "strip-aliased": boolean
  "strip-dashed": boolean
  "unknown-options-as-args": boolean
}

export type ArrayOption = string | { key: string; boolean?: boolean; string?: boolean; number?: boolean }

export interface Options {
  alias?: Record<string, string | string[]>
  array?: ArrayOption | ArrayOption[]
  boolean?: string | string[]
  coerce?: Record<string, (arg: any) => any>
  count?: string | string[]
  default?: Record<string, any>
  narg?: Record<string, number>
  normalize?: string | string[]
  number?: string | string[]
  string?: string | string[]
  configuration?: Partial<Configuration>
}

export interface DetailedArguments {
  argv: Arguments
  error: Error | null
  aliases: Record<string, string[]>
  newAliases: Record<string, boolean>
  defaulted: Record<string, boolean>
  configuration: Configuration
}

export interface Parser {
  (args: string | any[], opts?: Options): Arguments
  detailed(args: string | any[], opts?: Options): DetailedArguments
  camelCase(str: string): string
  decamelize(str: string, joinString?: string): string
  looksLikeNumber(x: null | undefined | number | string): boolean
}

declare const parser: Parser
export default parser
```

```ts
import parser from "./index.js"

parser(["--foo=33", "--bar", "hello"]) // { _: [], foo: 33, bar: "hello" }
parser("--foo=99 --bar=33") // { _: [], foo: 99, bar: 33 }
parser(["-x", "1", "-x", "2", "pos"]) // { _: ["pos"], x: [1, 2] }
```

### parser(args, opts = {})

Parses `args` and returns the options and positionals.

- `args` is an array of arguments (items that are not strings are converted
  with `String`) or one string. A string is trimmed and split on runs of
  spaces outside single or double quotes; the quotes stay in the tokens, and
  an option value taken from a string input loses one pair of matching
  surrounding quotes (`--name "a b"` gives `"a b"` without quotes). The
  parser never modifies an array passed to it.
- The result always has `_`, the positional arguments in order; every other
  key is an option. It is a plain object.
- `--` ends option parsing: every later argument is appended to `_` as it
  is, without number conversion. A lone `-` and an argument of three or more
  dashes on their own or before `=` (`---`, `----=x`) are positionals.
- `--key=value` sets `key` to everything after the first `=` (possibly
  `""`). `--key value` takes the next argument as the value when it does
  not start with `-` or is a negative number (`-5`, `-.5`), unless the
  key is a boolean; a next argument that is exactly `true` or `false` is
  always taken. Otherwise the key gets its empty value: `true` for untyped
  and boolean keys, `""` for string keys, `undefined` for number keys,
  `[]` for array keys, or the key's `default` when it has one and is not a
  boolean.
- `--no-key` sets `key` to `false` (boolean negation).
- Short options: `-a value` works like a long option with a one-letter name.
  In a group such as `-abc` every letter but the last is set to `true` (or
  its empty value) and the last letter behaves like `-c`, with these
  exceptions: a letter followed by `=` takes the rest of the group as its
  value (`-n=5`); a letter followed by a number takes the number
  (`-n5`, `-xn-1.5`); a letter followed by a non-word character takes the
  rest of the group (`-f/usr/bin`, `-a-` sets `a` to `"-"`). The last
  letter of a group takes the next argument unless that looks like an option
  (`-x` or `--x`); a lone `-` is taken as a value.
- A negative number such as `-5` is a positional, except that `-0` to `-9`
  set a one-digit key that is declared boolean (`-0` with `boolean: ["0"]`).
- Dot notation: `--a.b.c 1`, `--a.b.c=1`, `-a.b 1` and `-a.b=1` set
  `{ a: { b: { c: 1 } } }`. When a segment already holds a non-object value,
  it becomes an array of that value and a new object that receives the rest.
- A key or dotted segment named `__proto__` is stored as `___proto___`.
- Camel-case expansion: a key containing `-` is also set under its camel-case
  form (`--foo-bar 1` gives `foo-bar: 1` and `fooBar: 1`; in a dotted key
  each segment is converted). Configured names (aliases, defaults, typed
  keys) written in camelCase also get their kebab-case form as an alias.
- Numbers: a value (or positional) becomes a number when it looks like one —
  an optional `-`, digits with an optional fraction or a leading-dot
  fraction, an optional exponent, or hexadecimal `0x…` — and
  `Math.floor(parseFloat(value))` is a safe integer. Values with a leading
  `0` (other than `0.`) or `+` stay strings, as do values too large to be
  safe integers. Keys declared as strings or booleans are never converted;
  keys declared as numbers always are (`Number(value)`, so `NaN` is
  possible).
- Repeating an option collects its values in an array (`-x 1 -x 2` gives
  `[1, 2]`), except for booleans, where the last value wins.
- A boolean key never takes the next argument unless it is `true` or
  `false`; a value given to a boolean key (`--flag=yes`) becomes
  `value === "true"`.
- `alias`: `{ alias: { foo: ["f"] } }` makes `foo` and `f` the same option;
  alias lists that share a name are merged (aliases are transitive), every
  name gets the value, and the result contains all of them. Aliases of the
  first segment of a dotted key also receive the nested value.
- `default`: after parsing, each default whose key (dotted keys are paths)
  was not set is applied to the key and its aliases. A boolean key without a
  default that was not given is absent from the result.

#### Options

- `opts.boolean`, `opts.string`, `opts.number`: keys (a name or a list)
  parsed as booleans, strings (never converted to numbers, even `-x 33`)
  or numbers.
- `opts.array`: keys parsed as arrays, either names or
  `{ key, boolean?, string?, number? }` objects that also type the
  elements. An array key takes every following argument up to the next one
  that starts with `-` (negative numbers excepted): `--list a b c` gives
  `["a", "b", "c"]`. With `=` the value after `=` is the first element and
  following arguments are added. With no values the key is `[]` (or its
  default, wrapped in an array). A boolean array key gets `[true]` when no
  `true`/`false` follows, and `--no-key` gives `[false]`. Repeating an
  array key adds its values (see `flatten-duplicate-arrays`).
- `opts.count`: keys that count their occurrences: `-vvv` gives `v: 3`,
  `--verbose --verbose` gives `verbose: 2`. A count never takes the next
  argument and is `0` when absent (or its default).
- `opts.narg`: `{ key: n }` makes `key` take exactly `n` following
  arguments (stopping early at one that looks like an option such as `-x`,
  unless `nargs-eats-options` is set); several values become an array. A
  value after `=` counts as the first one. `n = 0` takes none. A non-number
  is ignored and `NaN` means one (for an array key: at least one). When
  fewer than `n` are available, the error is
  `Not enough arguments following: key`; `--key=value` on a key with
  `n = 0` gives `Argument unexpected for: key`. An array key with a narg
  takes at most `n` values.
- `opts.coerce`: `{ key: fn }` replaces the final value of `key` (after
  defaults, once per key and its aliases, with the whole array for array
  keys) by `fn(value)`, converted to a number by the usual rules. An error
  thrown by `fn` becomes the parse error and the key keeps its value.
- `opts.default`: default values, see above.
- `opts.normalize`: keys whose string values are passed through Node's
  `path.normalize` (each element for array keys).
- `opts.configuration`: the flags below.
- Declaring a key both as a count and as an array or narg is an error:
  `Invalid configuration: key, opts.count excludes opts.array.` (or
  `opts.narg.`).

Errors never throw: `parser` ignores them and `parser.detailed` reports the
last one in `error` (as an `Error` with that message) while still parsing.

#### Configuration

Each flag of `opts.configuration` defaults as shown:

- `short-option-groups` (true): `-abc` is three options; when false it is
  the key `abc` (and `-abc=1` sets `abc`).
- `camel-case-expansion` (true): hyphenated keys also get their camel-case
  form, and camelCase configured names their kebab-case alias.
- `dot-notation` (true): dotted keys create nested objects; when false
  `--foo.bar` sets the key `"foo.bar"`.
- `parse-numbers` (true): convert option values that look like numbers.
  When false, only keys declared as numbers are converted.
- `parse-positional-numbers` (true): convert positionals that look like
  numbers.
- `boolean-negation` (true) and `negation-prefix` (`"no-"`):
  `--<prefix>key` sets `key` to false; when disabled, `--no-key` is the
  option `no-key`.
- `duplicate-arguments-array` (true): repeated options collect their values;
  when false the last value wins.
- `flatten-duplicate-arrays` (true): a repeated array option adds its values
  to one array (`-x 1 2 -x 3 4` gives `[1, 2, 3, 4]`); when false each
  occurrence becomes a nested array (`[[1, 2], [3, 4]]`).
- `greedy-arrays` (true): an array option takes all following values; when
  false it takes one value per occurrence.
- `nargs-eats-options` (false): narg also takes arguments that look like
  options.
- `halt-at-non-option` (false): parsing stops at the first positional, which
  and everything after it go to `_` (or `--`) unchanged.
- `populate--` (false): arguments after `--` go to a `"--"` array instead
  of `_`.
- `set-placeholder-key` (false): every configured key (from `array`,
  `boolean`, `string`, `number`, `count`, `normalize`, `narg`,
  `coerce`) that is not dotted and has no value is set to `undefined`.
- `strip-aliased` (false): remove aliases (and their camel-case forms) from
  the result. `strip-dashed` (false): remove keys containing `-` (only when
  camel-case expansion is on).
- `unknown-options-as-args` (false): an option whose name is not configured
  (not in any option list, alias or default) is treated as a positional,
  with its value as written (`--unknown=1` stays `"--unknown=1"`).

### parser.detailed(args, opts = {})

Parses like `parser` and returns:

- `argv`: the parsed object.
- `error`: `null`, or the last error raised while parsing.
- `aliases`: every configured key with its full alias list (including
  inferred camel-case and kebab-case forms), for example
  `{ foo: ["f"], f: ["foo"] }`.
- `newAliases`: the names added by camel-case expansion, `{ fooBar: true }`.
- `defaulted`: the keys set from `opts.default`, aliases excluded,
  `{ foo: true }`.
- `configuration`: the effective configuration.

### Helpers

- `parser.camelCase(str)`: unless `str` is already mixed case it is
  lower-cased first; then leading hyphens are dropped and every `-` or `_`
  is removed, upper-casing the following character: `"hello-world"` →
  `"helloWorld"`, `"NODE_VERSION"` → `"nodeVersion"`.
- `parser.decamelize(str, joinString = "-")`: every upper-case character
  after the first position becomes `joinString` plus its lower-case form:
  `"helloWorld"` → `"hello-world"`.
- `parser.looksLikeNumber(x)`: false for `null` and `undefined`, true for
  numbers and hexadecimal strings (`0x1F`), false for strings with a leading
  `0` followed by anything but `.`, otherwise whether the string matches an
  optional `-`, digits with an optional fraction (or a `.` fraction) and an
  optional exponent.

## Examples

```ts
parser(["-abc", "x"]) // { _: [], a: true, b: true, c: "x" }
parser(["--foo-bar", "1"]) // { _: [], "foo-bar": 1, fooBar: 1 }
parser(["--a.b", "1", "--no-color"]) // { _: [], a: { b: 1 }, color: false }
parser(["-vvv", "--list", "1", "2"], { count: ["v"], array: ["list"] }) // { _: [], v: 3, list: [1, 2] }
parser(["--x", "5"], { string: ["x"] }) // { _: [], x: "5" }
parser(["a", "--", "-b"], { configuration: { "populate--": true } }) // { _: ["a"], "--": ["-b"] }
parser.detailed(["--file"], { narg: { file: 2 } }).error?.message // "Not enough arguments following: file"
```
