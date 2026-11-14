Implement dot-notation and nested objects of yargs-parser, the option parser used by yargs. The
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
  configuration?: { "dot-notation"?: boolean }
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

## Dot notation

- A key containing `.` is a path: `--foo.bar.baz=1`, `--foo.bar.baz 1`,
  `-f.x 1` and `-f.x=1` set `{ foo: { bar: { baz: 1 } } }`; without a value
  the leaf is `true` (or the key's empty value). Segments are created as
  plain objects; several paths under one key share the object.
- A segment that already holds a non-object value (or an array) becomes an
  array whose last element is a new object receiving the rest of the path
  (`--a 1 --a.b 2` gives `a: [1, { b: 2 }]`), and a later plain value for a
  key that holds an object collects into an array like any repeated option.
- Options, aliases and defaults may use dotted names. `default: { "foo.bar": 1 }`
  fills `foo.bar` when that path was not set; a default for a whole object
  (`default: { foo: {...} }`) applies only when `foo` was not set at all.
- An alias of the full dotted key receives the value (`alias: { "a.b": ["ab"] }`).
  An alias of the first segment receives the same nested value
  (`alias: { foo: ["f"] }` makes `--foo.bar 1` also set `f: { bar: 1 }`).
- Typed dotted keys work like typed keys (`string: ["foo.id"]` keeps
  `--foo.id 0123` a string).
- Camel-case expansion applies per segment (`--foo.bar-baz 1` also sets
  `foo.barBaz`).
- A segment named `__proto__` is stored as `___proto___`, so parsing never
  changes `Object.prototype`.
- `configuration: { "dot-notation": false }` turns all of this off: dotted
  names are ordinary flat keys (`--foo.bar 1` sets `"foo.bar": 1`, a
  default for `"foo.bar"` is the flat key, and aliases of the first segment
  are not populated).

```ts
parser(["--foo.bar", "3", "--foo.baz", "x"]) // { _: [], foo: { bar: 3, baz: "x" } }
parser(["--foo.bar=1"], { alias: { foo: ["f"] } }) // { _: [], foo: { bar: 1 }, f: { bar: 1 } }
parser([], { default: { "a.b": 2 } }) // { _: [], a: { b: 2 } }
parser(["--a.b", "1"], { configuration: { "dot-notation": false } }) // { _: [], "a.b": 1 }
```
