Implement dotenv's `.env` parser: `parse(src, options)` turns the text of
a `.env` file into an object of strings.

```ts
export function parse(src: string | Buffer, options?: { fast?: boolean }): Record<string, string>
```

Returns a plain object with one string per variable, in the order the keys
first appear.

- Line endings are normalised first: `\r\n` and a lone `\r` both become
  `\n`. A `Buffer` is converted with `toString()`.
- Each assignment is `KEY=VALUE` or `KEY: VALUE` (a colon must be
  followed by at least one whitespace character, which may be a line break).
  Whitespace around the key and around `=` is ignored, and an optional
  `export ` prefix is dropped (`export` followed by `=` or `:` is itself
  a key). Keys are made of letters, digits, `_`, `.` and `-`. Lines that
  are not assignments are skipped.
- Empty values become empty strings (`EMPTY=` → `""`). Lines starting
  with `#` are comments, and `#` starts a comment in an unquoted value
  (`A=x # y` and `A=x#y` are both `"x"`).
- Unquoted values are trimmed and inner quotes are kept
  (`JSON={"foo": "bar"}` → `{"foo": "bar"}`); an unquoted value that
  starts and ends with the same quote character loses those two characters.
- A value wrapped in single quotes, double quotes or backticks keeps its
  inner whitespace and any `#`, and may span several lines. The opening
  quote may follow blank lines after the separator. A quote character
  preceded by a backslash does not close the value; backslashes are kept as
  written. A quoted value counts only when nothing but whitespace or a
  comment follows its closing quote on that line; otherwise the line is read
  as an unquoted value (`TOKEN="abc" oops` → `"abc" oops`).
- When a value starts with a double quote, the two-character sequences `\n`
  and `\r` in it become a newline and a carriage return. Single-quoted,
  backtick and unquoted values are not expanded.
- `\u2028` and `\u2029` end comments and lines the way JavaScript's
  multiline regular expressions do, but they may appear inside unquoted
  values.
- When a key appears more than once, the last value wins.
- `{ fast: true }` selects an alternative hand-written scanner in the real
  library. It must return exactly what the default parser returns; one
  parser may serve both.

```ts
parse("BASIC=basic") // { BASIC: "basic" }
parse(Buffer.from("A=1\r\nB=2")) // { A: "1", B: "2" }
parse("INLINE=inline comments # work") // { INLINE: "inline comments" }
parse("SPACED='  keep  '\nEXPAND=\"a\\nb\"\nRAW='a\\nb'")
// { SPACED: "  keep  ", EXPAND: "a\nb", RAW: "a\\nb" }
parse("PEM=\"-----BEGIN-----\nabc\n-----END-----\"")
// { PEM: "-----BEGIN-----\nabc\n-----END-----" }
parse("    SPACED_KEY = parsed\nexport EXPORTED=1\nCOLON: yes")
// { SPACED_KEY: "parsed", EXPORTED: "1", COLON: "yes" }
```
