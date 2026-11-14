`dotenv` loads environment variables from a `.env` file into
`process.env` (or another object). It parses the `.env` format, copies the
parsed variables into a target object without overwriting what is already
there, and logs a one-line summary.

## API

```ts
export interface DotenvParseOptions {
  fast?: boolean
}

export interface DotenvConfigOptions {
  path?: string | string[] | URL
  encoding?: string
  quiet?: boolean
  debug?: boolean
  override?: boolean
  fast?: boolean
  processEnv?: Record<string, string | undefined>
}

export interface DotenvConfigOutput {
  parsed?: Record<string, string>
  error?: Error & { code?: string }
}

export interface DotenvPopulateOptions {
  debug?: boolean
  override?: boolean
}

export function parse(src: string | Buffer, options?: DotenvParseOptions): Record<string, string>
export function populate(
  processEnv: Record<string, string | undefined>,
  parsed: Record<string, string | undefined>,
  options?: DotenvPopulateOptions
): Record<string, string | undefined>
export function config(options?: DotenvConfigOptions | null): DotenvConfigOutput
export function configDotenv(options?: DotenvConfigOptions | null): DotenvConfigOutput
```

Use only named exports.

## `parse(src, options)`

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
- `{ fast: true }` selects an alternative hand-written scanner. It must
  return exactly what the default parser returns; one parser may serve both.

## `populate(processEnv, parsed, options)`

- Copies each own enumerable key of `parsed` into `processEnv` and returns
  an object with the keys and values it actually set (an `undefined` value
  is copied as an own property too).
- A key that `processEnv` already has as an own property, even with an empty
  value, is overwritten only when `override` is set.
- With `debug`, each such existing key logs through `console.log`:
  `┆ "KEY" is already defined and WAS overwritten` or
  `┆ "KEY" is already defined and was NOT overwritten`.
- If `processEnv` or `parsed` is `null` or not an object, it throws an
  `Error` with message
  `OBJECT_REQUIRED: Please check the processEnv argument being passed to populate`
  and `code` `"OBJECT_REQUIRED"`.

## `config(options)` and `configDotenv(options)`

The two names are the same function.

- **Options and defaults.** `options` may be omitted or `null`. Options whose
  value is `undefined` count as not given. A missing option falls back to the
  environment variable `DOTENV_<NAME>`, or the legacy
  `DOTENV_CONFIG_<NAME>` when the first is unset, for `ENCODING`,
  `PATH`, `QUIET`, `DEBUG`, `OVERRIDE` and `FAST`, read from
  `process.env` when `config` is called.
- **Flags.** `quiet`, `debug`, `override` and `fast` (in `populate`
  too) may also be strings: `"false"`, `"0"`, `"no"`, `"off"` and `""`
  (any case) are false and every other string is true. Other values count by
  truthiness. Environment defaults are read the same way; `PATH` and
  `ENCODING` are used as given.
- **Files.** `path` is a file path, an array of paths, or a file `URL`; the
  default is `path.resolve(process.cwd(), ".env")`. A string path starting
  with `~` is expanded with `path.join(os.homedir(), rest)`. Each file is
  read with `fs.readFileSync(path, { encoding })` (`encoding` defaults to
  `"utf8"`) and parsed with `parse(contents, { fast })`. Call
  `fs.readFileSync`, `os.homedir` and `path.relative` when `config`
  runs: tests replace them.
- **Merging.** The files' variables are merged in order with `populate`
  semantics into one `parsed` object, so the first file wins unless
  `override` is set. A file that cannot be read or parsed is skipped and its
  error is kept; the last such error is returned. Then `parsed` is
  populated into `processEnv` (default `process.env`, used whenever the
  option is not `null` or `undefined`) with the same `override` and
  `debug` options.
- **Return value.** `{ parsed }`, or `{ parsed, error }` when an error was
  kept. The `error` key is absent, not `undefined`, on success.
- **Logging.** `quiet` is the explicit option if one was given, otherwise
  `DOTENV_QUIET`/`DOTENV_CONFIG_QUIET` read from the target
  `processEnv` after it was populated, so a `.env` file can silence its own
  load. When `debug` is on or `quiet` is off, `config` writes one line to
  `console.error`: `◇ injected env (N) from P`, where `N` is the number
  of keys `populate` actually set and `P` is the comma-joined list of each
  path relative to `process.cwd()` (a `URL` is converted with
  `fileURLToPath` first). If computing one of those relative paths throws,
  that error becomes the returned error.
- **Debug output** goes to `console.log` with the prefix `┆ `:
  `┆ no encoding is specified (UTF-8 is used by default)` when no encoding
  was given, `┆ failed to load <path> <error message>` for each file or
  path that failed, plus `populate`'s messages.

## Examples

```ts
parse("BASIC=basic\n# comment\nQUOTED=\"a # b\"\nexport NEXT: 'x'")
// { BASIC: "basic", QUOTED: "a # b", NEXT: "x" }
parse("MULTI=\"one\ntwo\"\nESCAPED=\"a\\nb\"")
// { MULTI: "one\ntwo", ESCAPED: "a\nb" }

const env: Record<string, string | undefined> = { BASIC: "existing" }
populate(env, { BASIC: "new", OTHER: "1" }) // { OTHER: "1" }; env.BASIC stays "existing"

config({ path: [".env.local", ".env"], processEnv: env })
// reads both files; .env.local wins; logs "◇ injected env (3) from .env.local,.env"
config({ path: "missing.env", quiet: true }).error?.code // "ENOENT"
```
