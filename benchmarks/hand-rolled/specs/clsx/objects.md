Implement the dictionary handling of `clsx`, which builds a `className`
string from its arguments: strings are used as given and objects map class
names to on/off values.

```ts
export function clsx(...inputs: unknown[]): string
export default clsx
```

The default export and the named `clsx` export must be the same function.
Only strings, `true`, falsy values and objects are graded as arguments;
arrays and numbers other than `0` are not.

- Each argument contributes zero or more class names, joined with a single
  space in argument order, with no leading, trailing or doubled separators.
  `clsx()` is `""`. It never throws.
- Falsy arguments (`false`, `""`, `0`, `null`, `undefined`) and `true`
  are discarded. A non-empty string is used as is, without trimming.
- An object contributes every key that a `for...in` loop visits (own and
  inherited enumerable string keys, in `for...in` order, so integer-like keys
  come first in ascending order) whose value is truthy. Values are only
  tested for truthiness: `"hiya"`, `{}`, `[]`, functions and `1n` switch
  a key on; `""`, `0`, `-0`, `NaN`, `null`, `undefined`, `false` and
  `0n` switch it off. Keys such as `push` or `length` are ordinary keys.
  Objects without a prototype work the same way.

```ts
clsx({ foo: true, bar: false, baz: 1 }) // "foo baz"
clsx({ foo: true }, { bar: false }, null, { "--foobar": "hello" }) // "foo --foobar"
clsx("hello", { world: 1, push: true }) // "hello world push"
clsx({ b: 1, 2: 1, a: 1 }) // "2 b a"
clsx("", "b", {}, "") // "b"
```
