Implement array options and narg of yargs-parser, the option parser used by yargs. The
module's default export is the parser; it supports only the options listed
here, every other configuration flag keeps its default, and behaviour must
match yargs-parser 22 exactly for these options.

```ts
export interface Arguments {
  _: (string | number)[]
  "--"?: (string | number)[]
  [argName: string]: any
}

export type ArrayOption = string | { key: string; boolean?: boolean; string?: boolean; number?: boolean }

export interface Options {
  alias?: Record<string, string | string[]>
  array?: ArrayOption | ArrayOption[]
  boolean?: string | string[]
  default?: Record<string, any>
  narg?: Record<string, number>
  number?: string | string[]
  string?: string | string[]
  configuration?: {
    "duplicate-arguments-array"?: boolean
    "flatten-duplicate-arrays"?: boolean
    "greedy-arrays"?: boolean
    "nargs-eats-options"?: boolean
  }
}

export interface Parser {
  (args: string | any[], opts?: Options): Arguments
  detailed(args: string | any[], opts?: Options): { argv: Arguments; error: Error | null }
}

declare const parser: Parser
export default parser
```

`opts.boolean`, `opts.string` and `opts.number` declare keys (a name or a
list) parsed as booleans, strings (never converted to numbers) or numbers.
`parser.detailed` parses the same way and returns `{ argv, error }`, where
`error` is `null` or the last parse error (an `Error`); parsing never
throws.

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

## Arrays

- `opts.array` lists keys parsed as arrays, as names or
  `{ key, boolean?, string?, number? }` objects that also type the elements.
  The declaration covers the key's aliases and its camel-case/kebab-case
  forms.
- An array key takes every following argument up to the next one that
  starts with `-` (negative numbers such as `-1` or `-.5` excepted):
  `--list a b c` gives `["a", "b", "c"]`. With `=` (`--list=a b` or
  `-l=a`) the value after `=` is the first element and following
  arguments are added.
- With no values the key is `[]`, or its default wrapped in an array (an
  array default is used as it is).
- A boolean array key takes no values unless the next argument is `true` or
  `false`: `--flags` gives `[true]`, `--no-flags` gives `[false]`.
- `greedy-arrays` (default true): when false, an array key takes one value
  per occurrence (`--arr 1 2` gives `arr: [1]` and `_: [2]`).

## Repeated options

- `duplicate-arguments-array` (default true): a repeated non-array option
  collects its values (`-x 1 -x 2` gives `[1, 2]`); when false the last
  value wins. Booleans always keep the last value.
- `flatten-duplicate-arrays` (default true): a repeated array option adds
  its values to one array (`-x 1 2 -x 3 4` gives `[1, 2, 3, 4]`); when
  false each occurrence becomes its own nested array (`[[1, 2], [3, 4]]`,
  and `-x 1 -x 2` gives `[[1], [2]]`).
- With `duplicate-arguments-array: false` a repeated array option keeps only
  its latest values (`-x 1 2 -x 3 4` gives `[3, 4]`), whatever
  `flatten-duplicate-arrays` says.

## narg

- `opts.narg: { key: n }` makes `key` (and its aliases) take exactly `n`
  following arguments; with `n > 1` (or repeated) the values collect in an
  array, with `n = 1` the value is set once. A value after `=` counts as
  the first one. `n = 0` takes nothing and sets the key's empty value.
  A narg that is not a number is ignored; `NaN` means one.
- Arguments that look like options (`-x`, `--x`, but not negative numbers)
  are not taken and end the count early, unless `nargs-eats-options`
  (default false) is set, in which case the next `n` arguments are taken
  whatever they are.
- Fewer than `n` available arguments give the error
  `Not enough arguments following: key` (the available ones are still
  taken). `--key=value` or `-k=value` on a key with `n = 0` gives
  `Argument unexpected for: key`.
- A narg on a key with `duplicate-arguments-array: false` restarts the
  key's values when it is repeated, keeping the latest group.
- An array key with a narg takes at most `n` values and gives the
  `Not enough arguments following: key` error when it got fewer; a narg of
  `NaN` on an array key means one or more values (none is the error). A
  boolean array key with a narg raises no error when it gets no values.

```ts
parser(["--list", "1", "2", "--other"], { array: ["list"] }) // { _: [], list: [1, 2], other: true }
parser(["--n", "1", "2"], { array: [{ key: "n", string: true }] }) // { _: [], n: ["1", "2"] }
parser(["-x", "1", "2", "-x", "3"], { array: ["x"], configuration: { "flatten-duplicate-arrays": false } }) // { _: [], x: [[1, 2], [3]] }
parser(["--point", "1", "2", "3"], { narg: { point: 2 } }) // { _: [3], point: [1, 2] }
parser.detailed(["--point", "1"], { narg: { point: 2 } }).error?.message // "Not enough arguments following: point"
```
