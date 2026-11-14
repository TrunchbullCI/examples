Implement the string, number and array handling of `clsx`, which builds a
`className` string from its arguments and keeps only the parts that are
switched on.

```ts
export function clsx(...inputs: unknown[]): string
export default clsx
```

The default export and the named `clsx` export must be the same function.
Only strings, numbers, booleans, `null`, `undefined`, functions and
(nested) arrays of these are graded; plain objects are not.

- Each argument contributes zero or more class names, joined with a single
  space in argument order, with no leading, trailing or doubled separators.
  `clsx()` is `""`. It never throws.
- Falsy values (`false`, `""`, `0`, `-0`, `NaN`, `null`, `undefined`)
  are discarded, and so are `true` and functions.
- A string is used as is, without trimming or splitting. A number is
  converted with JavaScript's string conversion (`0.1` → `"0.1"`,
  `Infinity` → `"Infinity"`, `1e21` → `"1e+21"`).
- An array is flattened recursively, to any depth, using these same rules for
  its items; an item that produces nothing (an empty string, an empty or
  all-falsy array) leaves no extra space.

```ts
clsx("foo", true && "bar", "baz") // "foo bar baz"
clsx(1, 2) // "1 2"
clsx(["foo", 0, false, "bar"]) // "foo bar"
clsx(["foo"], ["", 0, false, "bar"], [["baz", [["hello"], "there"]]]) // "foo bar baz hello there"
clsx("a", [[]], ["", [[], null]]) // "a"
```
