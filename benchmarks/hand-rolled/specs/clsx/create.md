`clsx` builds a `className` string from any mix of strings, numbers,
objects and (nested) arrays, keeping only the parts that are switched on. It
is a drop-in replacement for the `classnames` module.

## API

```ts
export type ClassValue = ClassArray | ClassDictionary | string | number | bigint | null | boolean | undefined
export type ClassDictionary = Record<string, any>
export type ClassArray = ClassValue[]

export function clsx(...inputs: ClassValue[]): string
export default clsx
```

The default export and the named `clsx` export are the same function. It
always returns a string (`clsx()` is `""`) and never throws.

## Behaviour

- Any number of arguments is accepted. Each argument contributes zero or more
  class names, and the contributions are joined with a single space, in
  argument order, with no leading, trailing or doubled separators.
- Falsy arguments (`false`, `""`, `0`, `-0`, `NaN`, `null`,
  `undefined`) are discarded, and so is `true`.
- A string is used as is, without trimming or splitting (`" x "` stays
  `" x "`). A number is converted with JavaScript's string conversion
  (`1` → `"1"`, `Infinity` → `"Infinity"`).
- An array is flattened recursively, to any depth: each truthy item is turned
  into class names by these same rules, and items that produce nothing (empty
  strings, empty arrays, objects with no truthy values) leave no extra space.
- Any other object is a dictionary: every key that a `for...in` loop visits
  (own and inherited enumerable string keys, in `for...in` order, so
  integer-like keys come first in ascending order) is included when its value
  is truthy. The value itself is never printed; `{ push: true }` gives
  `"push"`.
- Functions, bigints, symbols and booleans contribute nothing, at the top
  level and inside arrays.

## Examples

```ts
clsx("foo", true && "bar", "baz") // "foo bar baz"
clsx({ foo: true, bar: false, baz: 1 }) // "foo baz"
clsx({ foo: true }, { bar: false }, null, { "--foobar": "hello" }) // "foo --foobar"
clsx(["foo", 0, false, "bar"]) // "foo bar"
clsx(["foo"], ["", 0, false, "bar"], [["baz", [["hello"], "there"]]]) // "foo bar baz hello there"
clsx("foo", [1 && "bar", { baz: false, bat: null }, ["hello", ["world"]]], "cya") // "foo bar hello world cya"
clsx(true, false, "", null, undefined, 0, NaN) // ""
```
