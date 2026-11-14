Implement booleans, boolean negation and camel-case expansion of yargs-parser, the option parser used by yargs. The
module's default export is the parser; it supports only the options listed
here, every other configuration flag keeps its default, and behaviour must
match yargs-parser 22 exactly for these options.

```ts
export interface Arguments {
  _: (string | number)[]
  "--"?: (string | number)[]
  [argName: string]: any
}

export interface Options {
  alias?: Record<string, string | string[]>
  boolean?: string | string[]
  default?: Record<string, any>
  number?: string | string[]
  string?: string | string[]
  configuration?: {
    "boolean-negation"?: boolean
    "negation-prefix"?: string
    "camel-case-expansion"?: boolean
  }
}

export default function parser(args: string | any[], opts?: Options): Arguments
```

`opts.boolean`, `opts.string` and `opts.number` declare keys (a name or a
list) parsed as booleans, strings (never converted to numbers) or numbers.

## Parsing (default configuration)

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

## Booleans

- An undeclared option without a value is `true`: `--flag`, `-f`, and every
  letter of a group such as `-abc` except one that takes a value.
- A key declared in `opts.boolean` (or through any of its aliases) never takes
  the next argument as its value, except an argument that is exactly `true`
  or `false`; `--flag=value` and `--flag true` give `value === "true"`.
  In a group (`-xvf file`) a boolean last letter leaves `file` positional.
  Digits after a letter are normally its value (`-n5`), but not when the
  digits are a declared boolean: `-x0` with `boolean: ["x", "0"]` sets both
  `x` and `0` to `true`.
- `-0` … `-9` set the one-digit key when it is declared boolean (as in
  `xargs -0`); otherwise they are negative numbers.
- Repeating a boolean keeps the last value instead of collecting an array.
- A boolean that is not given is absent from the result unless it has a
  default; defaults of `true`, `false`, `undefined` and `null` are used as
  they are.
- Boolean negation: `--no-flag` sets `flag` to `false` (for any key,
  declared or not), whatever its default. `negation-prefix` replaces `no-`
  (`--quuxflag` with prefix `quux`). With `"boolean-negation": false`,
  `--no-flag` is an ordinary option named `no-flag`.

## Camel-case expansion

- A key containing `-` is also set under its camel-case form, built by
  `camelCase`: `--foo-bar` sets `foo-bar` and `fooBar`, `--no-cache-dir`
  sets `cache-dir` and `cacheDir`. The two names are aliases of each other
  for the rest of the parse, so later values and declarations apply to both.
- Configured names are expanded too: an alias, default or typed key written
  with dashes gets its camel-case form, and one written in camelCase (longer
  than one character) gets its kebab-case form (`fooBar` → `foo-bar`), so
  `--foo-bar` and `--fooBar` reach the same option and both names appear in
  the result. One-character names are left as they are.
- `camelCase(str)`: unless `str` is already mixed case it is lower-cased
  first; then leading hyphens are dropped and every `-` or `_` is removed,
  upper-casing the following character.
- With `"camel-case-expansion": false` no camel-case or kebab-case names are
  added.

```ts
parser(["-ab", "--no-color"]) // { _: [], a: true, b: true, color: false }
parser(["--verbose", "file.txt"], { boolean: ["verbose"] }) // { _: ["file.txt"], verbose: true }
parser(["--debug=false"], { boolean: ["debug"] }) // { _: [], debug: false }
parser(["--dry-run"]) // { _: [], "dry-run": true, dryRun: true }
parser([], { default: { fooBar: 1 } }) // { _: [], fooBar: 1, "foo-bar": 1 }
parser(["--no-dice"], { configuration: { "boolean-negation": false } }) // { _: [], "no-dice": true, noDice: true }
```
